/**
 * ui/packOpeningController.js — Phase 5.7 / 5.7.1
 *
 * Interactive booster-pack opening sequence with a real 3D illusion.
 *
 * Visual model:
 *   • The pack is a 3D box rendered with `transform-style: preserve-3d`,
 *     six faces (front, back, four edges) giving it real depth so it
 *     occludes/reveals correctly as it rotates.
 *   • While the pack is closed, pointer movement over the stage tilts
 *     the whole box (rotateX/rotateY) so it feels like a physical object.
 *   • Behind the front face sits a stack of card-backs (also at a Z
 *     between front and back). They're hidden by the front while the
 *     pack is sealed; when the top peels away, they become visible
 *     PEEKING OUT of the open wrapper.
 *   • The torn-off top piece flies away with rotation.
 *   • On swipe-up, the cards fully rise out of the pack and the
 *     overlay closes, handing off to the existing reveal flow.
 *
 * Pack art:
 *   • Real artwork is loaded from `${BASE_URL}packs/{setId}.png`. Drop a
 *     PNG with the matching setId into `public/packs/` for any set.
 *   • If real art is missing, falls back to the procedural foil look
 *     (silver/blue gradient + the set logo from the Pokémon TCG CDN).
 *
 * Returns a Promise that resolves only after the user swipes up.
 * The simulator's RNG, pity, and reveal logic are not touched.
 */

import {
  playPackCrinkle, playPackTear, playCardSlide,
} from './audioManager.js';
import { PACK_STORE } from '../data/packStore.js';

// Tear threshold now scales with pack width for responsive mobile interaction.
// Base is 40px on a 340px pack; scales down on smaller screens, up on larger screens.
const TEAR_THRESHOLD_SCALE = 0.12;    // 40px / 340px ≈ 0.118
const SWIPE_THRESHOLD_PX   = 40;      // vertical swipe threshold (fixed)
const TILT_MAX_DEG         = 6;       // subtle — pack hints at depth, not a box

let _overlay = null;

/**
 * Calculate responsive tear threshold based on pack width.
 * On a 340px pack → ~40px; on 280px (mobile) → ~34px; on 420px (tablet) → ~50px.
 * This makes the tear gesture feel consistent across screen sizes.
 */
function _getTearThreshold(packElement) {
  const rect = packElement.getBoundingClientRect();
  const packWidth = rect.width;
  return Math.max(30, Math.round(packWidth * TEAR_THRESHOLD_SCALE));
}

function getPublicAssetUrl(assetPath) {
  if (!assetPath) return '';
  const normalized = assetPath.replace(/^\/+/, '');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}/${normalized}`;
}

function _ensureOverlay() {
  if (_overlay) return _overlay;
  _overlay = document.createElement('div');
  _overlay.id = 'pack-opening-overlay';
  _overlay.className = 'pack-opening-overlay hidden';
  // Real Pokémon TCG card back, served from public/cards/. Used for every
  // card in the inside-the-pack stack — replaces the previous CSS pokéball.
  const cardBackUrl = 'https://images.pokemontcg.io/cardback.png';
  // The .pack-3d wrapper carries preserve-3d so all six faces and the
  // cards-inside layer share one 3D coordinate space. Tilt is applied here.
  _overlay.innerHTML = `
    <div class="pack-stage" id="pack-stage">
      <div class="booster-pack" id="booster-pack">
        <div class="pack-3d" id="pack-3d">
          <div class="pack-face pack-back"></div>
          <div class="pack-edge pack-edge-left"></div>
          <div class="pack-edge pack-edge-right"></div>
          <div class="pack-edge pack-edge-top"></div>
          <div class="pack-edge pack-edge-bottom"></div>

          <!-- Cards sitting INSIDE the wrapper. Z is between back and
               front, so they're naturally occluded until the top peels. -->
          <div class="pack-cards-inside" id="pack-cards-inside">
            <div class="card-back"><img src="${cardBackUrl}" alt="" draggable="false" /></div>
            <div class="card-back"><img src="${cardBackUrl}" alt="" draggable="false" /></div>
            <div class="card-back"><img src="${cardBackUrl}" alt="" draggable="false" /></div>
            <div class="card-back"><img src="${cardBackUrl}" alt="" draggable="false" /></div>
          </div>

          <!-- The pack body (front face). Has the foil bg + logo image
               as fallback and the real pack art as a layered img. -->
          <div class="pack-face pack-front" id="pack-front">
            <div class="pack-foil-bg"></div>
            <img class="pack-image" id="pack-image" alt="" draggable="false" />
            <div class="pack-shimmer"></div>
          </div>

          <!-- The torn-off top piece. Sits a hair in front of pack-front
               in Z so it's the visible surface until the tear completes,
               then animates away. Contains a real <img> so it clips
               the same artwork as pack-front without any background-image
               mis-alignment. -->
          <div class="pack-top" id="pack-top">
            <img id="pack-top-img" alt="" draggable="false" />
          </div>
        </div>

        <!-- Drag target for the seam. Outside .pack-3d so it doesn't
             receive 3D transforms (pointer events stay reliable). -->
        <div class="pack-seam" id="pack-seam" aria-label="Drag across to tear"></div>
        <!-- Visual-only dashed perforation line, hidden via JS after tear -->
        <div class="pack-seam-line" id="pack-seam-line"></div>
        <div class="pack-tear-hint" id="pack-tear-hint">Drag across the top to tear open</div>
      </div>
      <div class="swipe-prompt hidden" id="swipe-prompt">⬆ Swipe up</div>
      <div class="swipe-prompt hidden" id="tap-prompt">Tap to reveal</div>
    </div>
  `;
  document.body.appendChild(_overlay);
  return _overlay;
}

/**
 * Try the local /packs/{setId}.png first; fall back to the Pokémon TCG
 * CDN logo over the procedural foil if no local art exists.
 *
 * Sets `--pack-art-url` on the pack-top so its background can mirror the
 * top portion of the same artwork (background-position: top + scaled so
 * pack-top's 22% slice equals the top 22% of the full art).
 */
function _loadPackArt(setId) {
  const img       = _overlay.querySelector('#pack-image');
  const topImg    = _overlay.querySelector('#pack-top-img');
  const front     = _overlay.querySelector('#pack-front');
  const pack      = _overlay.querySelector('#booster-pack');
  const localPath = PACK_STORE[setId]?.art || `packs/${setId}.png`;
  const localUrl  = getPublicAssetUrl(localPath);
  const fallback  = `https://images.pokemontcg.io/${setId}/logo.png`;

  // Reset state — second-pack opens shouldn't inherit prior art classes.
  front.classList.remove('has-real-art');
  pack.classList.remove('pack-ready');   // opacity:0 until art loads

  // Probe local first
  const probe = new Image();
  probe.onload = () => {
    front.classList.add('has-real-art');
    // Both the front face and the pack-top piece use the same artwork URL;
    // pack-top clips it to the top 22% via overflow:hidden in CSS.
    img.src    = localUrl;
    topImg.src = localUrl;
    topImg.style.display = '';
    // Show pack as soon as the art image is painted — avoids grey flash
    img.onload = () => pack.classList.add('pack-ready');
    if (img.complete) pack.classList.add('pack-ready'); // cached
  };
  probe.onerror = () => {
    // No local art for this set — fall back to logo over procedural foil.
    img.src = fallback;
    img.onerror = () => { img.style.display = 'none'; };
    img.style.display = '';
    // Hide the pack-top img so the foil CSS gradient shows as fallback
    topImg.src = '';
    topImg.style.display = 'none';
    // Procedural foil is pure CSS and renders immediately — show the pack
    pack.classList.add('pack-ready');
  };
  probe.src = localUrl;
}

/** 3D pointer-tilt — runs only while the pack is sealed. */
function _attachTilt(stage, pack3d) {
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width  - 0.5;  // -0.5..0.5
    const cy = (e.clientY - r.top)  / r.height - 0.5;
    const rx = (-cy) * TILT_MAX_DEG * 2;
    const ry = ( cx) * TILT_MAX_DEG * 2;
    pack3d.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  };
  const onLeave = () => {
    pack3d.style.transform = 'rotateX(0deg) rotateY(0deg)';
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  return () => {
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
  };
}

export function openPackInteraction(setId) {
  return new Promise((resolve) => {
    const overlay = _ensureOverlay();
    _loadPackArt(setId);

    const stage      = overlay.querySelector('#pack-stage');
    const pack       = overlay.querySelector('#booster-pack');
    const pack3d     = overlay.querySelector('#pack-3d');
    const front      = overlay.querySelector('#pack-front');
    const seam       = overlay.querySelector('#pack-seam');
    const seamLine   = overlay.querySelector('#pack-seam-line');
    const top        = overlay.querySelector('#pack-top');
    const tearHint   = overlay.querySelector('#pack-tear-hint');
    const cardsInside= overlay.querySelector('#pack-cards-inside');
    const swipePrompt= overlay.querySelector('#swipe-prompt');
    const tapPrompt  = overlay.querySelector('#tap-prompt');

    // Reset all gesture-driven inline styles from any previous opening
    overlay.classList.remove('hidden');
    pack.classList.add('idle');
    pack.classList.remove('pack-torn', 'ripping', 'torn', 'pack-faces-hidden');
    top.style.cssText      = '';     // clears any leftover transforms on pack-top
    front.style.clipPath   = '';     // clear drag-clip from pack-front
    front.style.transition = '';     // clear any suppressed transitions
    seam.style.display = '';
    seamLine.classList.remove('hidden');
    cardsInside.style.cssText = '';
    cardsInside.classList.remove('cards-peek', 'cards-present', 'cards-fade-out');
    tearHint.classList.remove('hidden');
    swipePrompt.classList.add('hidden');
    tapPrompt.classList.add('hidden');
    pack3d.style.transform = '';

    // Idle crinkle on appearance
    setTimeout(() => playPackCrinkle(), 250);

    // 3D tilt on pointer movement (active only until tear completes)
    const detachTilt = _attachTilt(stage, pack3d);

    // ─── Tear gesture ───────────────────────────────────────────────────
    let tearStartX = null;
    let tearActive = false;
    let maxDx = 0;
    const tearThreshold = _getTearThreshold(pack);

    const onSeamDown = (e) => {
      // Prevent text selection only for mouse. CSS touch-action handles mobile.
      if (e.pointerType !== 'touch') e.preventDefault();
      tearStartX = e.clientX;
      maxDx = 0;
      tearActive = true;
      // Request pointer capture for reliable drag tracking across browsers
      try { seam.setPointerCapture?.(e.pointerId); } catch (_) {}
    };
    const onSeamMove = (e) => {
      if (!tearActive || tearStartX === null) return;
      const dx = e.clientX - tearStartX;
      if (Math.abs(dx) > Math.abs(maxDx)) maxDx = dx;
      const progress = Math.min(1, Math.abs(dx) / tearThreshold);
      // Clip pack-front from the top as the user drags — more reliable than
      // pack-top on iOS Safari (preserve-3d contexts ignore overflow/clip-path
      // on child elements in many WebKit builds).
      // c goes 0 → 22 as progress goes 0 → 1: top 22% disappears gradually.
      const c = progress * 22;
      front.style.transition = 'none';   // no CSS lag during live drag
      front.style.clipPath =
        `polygon(` +
        `0 ${c}%, 7% ${c - 0.7}%, 15% ${c + 0.9}%, 23% ${c - 1.1}%,` +
        `31% ${c + 0.8}%, 39% ${c - 0.9}%, 47% ${c + 1.1}%, 55% ${c - 0.7}%,` +
        `63% ${c + 0.9}%, 71% ${c - 0.8}%, 79% ${c + 1.2}%, 86% ${c - 1.0}%,` +
        `93% ${c + 0.9}%, 100% ${c}%, 100% 100%, 0 100%)`;
    };
    const onSeamUp = (e) => {
      if (!tearActive || tearStartX === null) return;
      const dx = e.clientX - tearStartX;
      tearActive = false;
      tearStartX = null;
      if (Math.abs(dx) >= tearThreshold) {
        completeTear(dx > 0 ? 1 : -1);
      } else {
        // Snap pack-front back to fully visible (no clip) on aborted tear
        front.style.transition = 'clip-path 0.18s ease-out';
        front.style.clipPath   = '';   // removes inline → CSS default (no clip)
        setTimeout(() => { front.style.transition = ''; }, 220);
      }
    };

    seam.addEventListener('pointerdown',   onSeamDown);
    seam.addEventListener('pointermove',   onSeamMove);
    seam.addEventListener('pointerup',     onSeamUp);
    seam.addEventListener('pointercancel', onSeamUp);

    function completeTear(direction) {
      pack.classList.remove('idle');
      pack.classList.add('pack-torn', 'ripping');
      // Remove ripping class after animation so pack-torn state takes over
      setTimeout(() => pack.classList.remove('ripping'), 500);
      // Hide the seam hit-target and its visual guide line permanently
      seam.style.display = 'none';
      seamLine.classList.add('hidden');
      tearHint.classList.add('hidden');
      // Add 'torn' to the booster-pack wrapper — the CSS selector
      // .booster-pack.torn .pack-front then clips the art face so the
      // top 22% of the artwork disappears, giving a torn-open look.
      // Clear the inline drag clip-path so the CSS `.torn .pack-front` jagged
      // clip takes over cleanly (inline style would override the class rule).
      front.style.transition = '';
      front.style.clipPath   = '';
      pack.classList.add('torn');
      detachTilt();
      // Lock the pack at a slight forward-tilt so the player is "looking
      // into" the open top — sells the 3D illusion.
      pack3d.style.transition = 'transform 0.5s ease-out';
      pack3d.style.transform  = 'rotateX(-18deg) rotateY(0deg)';

      playPackTear();

      // Cards inside become visible and peek out of the top
      setTimeout(() => {
        cardsInside.classList.add('cards-peek');
        playCardSlide();
      }, 220);

      setTimeout(() => {
        swipePrompt.classList.remove('hidden');
        attachSwipeListener();
      }, 700);
    }

    // ─── Swipe-up gesture: cards rise out and PRESENT above the pack ────
    function attachSwipeListener() {
      let swipeStartY = null;
      const onSwipeDown = (e) => { swipeStartY = e.clientY; };
      const onSwipeUp   = (e) => {
        if (swipeStartY === null) return;
        const dy = swipeStartY - e.clientY;
        swipeStartY = null;
        if (dy >= SWIPE_THRESHOLD_PX) presentCards();
      };
      overlay.addEventListener('pointerdown',  onSwipeDown);
      overlay.addEventListener('pointerup',    onSwipeUp);
      overlay.addEventListener('pointercancel',() => { swipeStartY = null; });
      // Tap-prompt accessibility fallback for swipe
      swipePrompt.addEventListener('click', presentCards, { once: true });

      function presentCards() {
        overlay.removeEventListener('pointerdown', onSwipeDown);
        overlay.removeEventListener('pointerup',   onSwipeUp);
        swipePrompt.classList.add('hidden');
        playCardSlide();
        // Cards rise out of the pack and sit floating above it,
        // back-side facing the user, ready to be tapped.
        cardsInside.classList.remove('cards-peek');
        cardsInside.classList.add('cards-present');
        // Fade only the pack face elements out — NOT pack-cards-inside which
        // is also a child. This keeps the cards visible while the pack art
        // and box edges disappear behind them.
        pack.classList.add('pack-faces-hidden');
        // Show the tap-to-reveal prompt after the rise animation lands
        setTimeout(() => {
          tapPrompt.classList.remove('hidden');
          attachTapListener();
        }, 500);
      }
    }

    // ─── Tap-to-reveal: hand off to the existing reveal system ──────────
    function attachTapListener() {
      const onTap = () => {
        overlay.removeEventListener('click', onTap);
        tapPrompt.classList.add('hidden');
        cardsInside.classList.add('cards-fade-out');
        setTimeout(() => {
          overlay.classList.add('hidden');
          seam.removeEventListener('pointerdown',   onSeamDown);
          seam.removeEventListener('pointermove',   onSeamMove);
          seam.removeEventListener('pointerup',     onSeamUp);
          seam.removeEventListener('pointercancel', onSeamUp);
          pack3d.style.transition = '';
          resolve();
        }, 220);
      };
      overlay.addEventListener('click', onTap);
    }
  });
}
