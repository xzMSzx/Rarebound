import { playCardFlip, playRareChime, playUltraHit } from './audioManager.js';
import { CARD_RENDER_TIERS, getTierCapabilities } from './renderTiers.js';
import { HoloController } from '../src/utils/HoloController.js';

let holoController = null;

/**
 * ui/cardRevealAnimator.js
 * Manages the large card displayed inside the fullscreen overlay.
 *
 * Responsibilities:
 *   - Build/replace the card DOM inside a given container
 *   - showMystery(isSuspense) — render the card back face
 *   - revealCard(rarity, isSuspense) — flip and apply rarity effects
 *   - slideOutCard() — exit animation between cards
 *   - clearCard() — immediate DOM clear
 *
 * State machine integration
 *   - setOverlayState(s) must be called by the orchestrator so this module
 *     can abort in-progress animations when the overlay enters 'summary' mode.
 *   - Valid states: 'idle' | 'revealing' | 'summary'
 *   - After every internal await, revealCard checks _overlayState and exits
 *     early if it is no longer 'revealing'.  This prevents late writes to
 *     DOM nodes that the summary has already replaced.
 */

const RARITY_LABEL = {
  common:    'Common',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
};

const RARITY_SYMBOL = {
  common:    '◆',
  rare:      '★',
  epic:      '✦',
  legendary: '♛',
};

// Phase 5.4.3 — Holo layers (iridescent bands + spotlight reflection) gated
// by REAL Pokémon rarity (card.rarityType), not the engine's 4-tier system.
// The engine emits common/rare/epic/legendary, but the actual Pokémon rarity
// flowing in via rarityType uses the camelCase TCG taxonomy below.
//
// Commons & uncommons stay clean. Reverse-holos are excluded so the
// foil-sweep effect doesn't visually compete with the holo.
const HOLO_RARITIES = new Set([
  'rare',
  'holoRare',
  'doubleRare',
  'illustrationRare',
  'ultraRare',
  'specialIllustrationRare',
  'hyperRare',
]);

// ─── Overlay state ────────────────────────────────────────────────────────────

let _overlayState = 'idle';   // 'idle' | 'revealing' | 'summary'

/**
 * Update the overlay state so animations can guard their async continuations.
 * @param {'idle'|'revealing'|'summary'} state
 */
export function setOverlayState(state) {
  _overlayState = state;
}

// ─── Card DOM helpers ─────────────────────────────────────────────────────────

/**
 * Build the two-face card element and mount it into the container.
 * @param {HTMLElement} container
 * @returns {{ wrapper, animator, translater, inner, frontFace, backFace }}
 */
function buildCard(container) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'overlay-card-wrapper card';
  wrapper.setAttribute('data-render-tier', 'showcase');
  wrapper.setAttribute('data-rb-interactive', 'true');
  wrapper.setAttribute('data-card-state', 'interactive');

  const animator = document.createElement('div');
  animator.className = 'card__animator';

  const translater = document.createElement('div');
  translater.className = 'card__translater';

  // The inner element owns only the card flip. HoloController rotates the
  // parent translater so tilt and flip transforms compose instead of competing.
  const inner = document.createElement('div');
  inner.className = 'overlay-card-inner';

  const frontFace = document.createElement('div');
  frontFace.className = 'overlay-card-face overlay-card-front';

  const backFace = document.createElement('div');
  backFace.className = 'overlay-card-face overlay-card-back-face';

  const glare = document.createElement('div');
  glare.className = 'card__glare';

  const shine = document.createElement('div');
  shine.className = 'card__shine';

  // Structure: .card > .card__animator > .card__translater > flip inner.
  // The visual foil layers live on the revealed face so they flip with it.
  backFace.appendChild(glare);
  backFace.appendChild(shine);

  inner.appendChild(frontFace);
  inner.appendChild(backFace);
  translater.appendChild(inner);
  animator.appendChild(translater);
  wrapper.appendChild(animator);
  container.appendChild(wrapper);

  return { wrapper, animator, translater, inner, frontFace, backFace, glare, shine };
}

/**
 * Render the mystery card-back into frontFace.
 * @param {HTMLElement} frontFace
 * @param {boolean}     isSuspense
 */
function renderFront(frontFace, isSuspense) {
  frontFace.innerHTML = `
    <img
      class="card-back-img ${isSuspense ? 'card-back-suspense' : ''}"
      src="https://images.pokemontcg.io/cardback.png"
      alt="Card back"
      draggable="false"
      decoding="async"
    />
  `;
}

/**
 * Render the revealed rarity face into backFace.
 * When imageUrl is supplied the face shows real card artwork;
 * otherwise it falls back to the rarity-symbol placeholder.
 *
 * @param {HTMLElement}  backFace
 * @param {string}       rarity
 * @param {string|null}  imageUrl  — optional Pokémon card image URL
 */
function renderBack(backFace, rarity, imageUrl = null, isReverseHolo = false, realRarity = null) {
  backFace.className = `overlay-card-face overlay-card-back-face rarity-reveal-${rarity}`;

  // Preserve glare and shine when replacing innerHTML
  const glare = backFace.querySelector('.card__glare');
  const shine = backFace.querySelector('.card__shine');

  if (imageUrl) {
    // Append immediately so foil layers mounted below survive image load/decode.
    backFace.innerHTML = '';
    if (glare) backFace.appendChild(glare);
    if (shine) backFace.appendChild(shine);
    const img = document.createElement('img');
    img.className = 'card-reveal-img';
    img.loading = 'eager';
    img.decoding = 'async';
    img.alt = (RARITY_LABEL[rarity] ?? rarity);
    let settled = false;
    img.onload = async () => {
      if (settled) return;
      settled = true;
      if (img.decode) {
        try { await img.decode(); } catch (e) { /* ignore decode errors */ }
      }
      // Ensure the backFace is still in the DOM before writing
      if (backFace && backFace.parentNode) {
        // Image already lives under backFace; do not clear foil layers.
      }
    };
    img.onerror = () => {
      if (settled) return; settled = true;
      if (backFace && backFace.parentNode) {
        backFace.innerHTML = `\n          <div class="card-reveal-art">\n            <span class="card-reveal-symbol">${RARITY_SYMBOL[rarity] ?? '?'}</span>\n            <span class="card-reveal-rarity">${RARITY_LABEL[rarity] ?? rarity}</span>\n          </div>`;
        renderBack(backFace, rarity, null, isReverseHolo, realRarity);
      }
    };
    // Non-blocking timeout: if the image doesn't load quickly, fall back to symbol
    const t = setTimeout(() => { if (!settled) img.onerror(); }, 1800);
    img.addEventListener('loadend' in img ? 'loadend' : 'load', () => clearTimeout(t));
    backFace.appendChild(img);
    img.src = imageUrl;
  } else {
    backFace.innerHTML = `
      <div class="card-reveal-art">
        <span class="card-reveal-symbol">${RARITY_SYMBOL[rarity] ?? '?'}</span>
        <span class="card-reveal-rarity">${RARITY_LABEL[rarity] ?? rarity}</span>
      </div>
    `;
    if (glare) backFace.appendChild(glare);
    if (shine) backFace.appendChild(shine);
  }

  // Phase 5.2 — reverse-holo foil shimmer (visual only; engine logic untouched).
  // Append foil + sweep overlays after the artwork so they paint above it.
  // .overlay-card-back-face has position:relative + overflow:hidden so the
  // layers anchor and clip to the card bounds.
  //
  // Phase 5.2.5 — the "Reverse Holo" caption used to live here pinned to the
  // bottom of the card, but it overlapped the printed card text. Caption is
  // now rendered by fullscreenOverlay.js as a flex-flow sibling below the
  // rarity diamond. Foil + sweep stay on the card itself.
  if (isReverseHolo) {
    const foil = document.createElement('div');
    foil.className = 'reverse-holo-overlay';

    const sweep = document.createElement('div');
    sweep.className = 'reverse-holo-sweep';

    backFace.appendChild(foil);
    backFace.appendChild(sweep);
  }

  // Phase 5.4.3 — gate on the REAL Pokémon rarity, not the engine 4-tier
  // value. realRarity comes from card.rarityType (set by main.js augmentCards).
  // If a caller forgets to pass it, fall back to the engine rarity so legacy
  // calls still trigger holo on whatever simple 'rare' cards exist.
  const rarityForHolo = realRarity ?? rarity;
  const tier = backFace.parentElement?.parentElement?.dataset.renderTier || CARD_RENDER_TIERS.SHOWCASE;
  const capabilities = getTierCapabilities(tier);

  if (!isReverseHolo && HOLO_RARITIES.has(rarityForHolo) && capabilities.holo) {
    const rainbow = document.createElement('div');
    rainbow.className = 'holo-rainbow';
    const reflection = document.createElement('div');
    reflection.className = 'holo-reflection';
    backFace.appendChild(rainbow);
    backFace.appendChild(reflection);

  }
}

// ─── Module-level card state ───────────────────────────────────────────────────

let _currentCard = null;   // { wrapper, inner, frontFace, backFace }
let _container   = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the animator with a DOM container.
 * Resets the overlay state to 'idle' so the next pack starts clean.
 * @param {HTMLElement} container
 */
export function initAnimator(container) {
  _container   = container;
  _currentCard = null;
  _overlayState = 'idle';
}

/**
 * Show the mystery card back. Call once per card before reveal.
 * @param {boolean} isSuspense
 */
export function showMystery(isSuspense = false) {
  if (!_container) return;
  _currentCard = buildCard(_container);

  // Phase 6.5.2 — wrap image injection in rAF so the browser has one layout
  // pass before the card back image mounts, preventing the ghost-line flicker.
  const card = _currentCard;
  requestAnimationFrame(() => {
    if (card === _currentCard) renderFront(card.frontFace, isSuspense);
  });

  // Pre-fill the hidden back face blank; revealCard fills it just before flip
  const glare = _currentCard.backFace.querySelector('.card__glare');
  const shine = _currentCard.backFace.querySelector('.card__shine');
  _currentCard.backFace.innerHTML = '';
  if (glare) _currentCard.backFace.appendChild(glare);
  if (shine) _currentCard.backFace.appendChild(shine);

  _currentCard.inner.classList.remove('overlay-flipped');

  if (isSuspense) {
    _currentCard.wrapper.classList.add('suspense-glow-large');
  }
}

/**
 * Flip the current card to reveal its rarity.
 * Guards every async continuation: if _overlayState is no longer 'revealing'
 * the function returns early so no DOM writes occur after skip.
 *
 * @param {string}       rarity
 * @param {boolean}      isSuspense  — slower flip + shake when true
 * @param {string|null}  imageUrl    — Pokémon card image URL, or null for placeholder
 * @returns {Promise<void>}            resolves when flip completes (or aborted early)
 */
export async function revealCard(rarity, isSuspense = false, imageUrl = null, isReverseHolo = false, realRarity = null) {
  if (!rarity) return;
  if (!_currentCard || _overlayState !== 'revealing') return;
  const { wrapper, inner, backFace } = _currentCard;

  // Fill the reveal face just before flipping. realRarity drives the holo
  // gating in renderBack; rarity (engine 4-tier) drives the glow/pulse class.
  renderBack(backFace, rarity, imageUrl, isReverseHolo, realRarity);

  // Suspense: shake first, then slow flip
  if (isSuspense) {
    wrapper.classList.remove('suspense-glow-large');
    await _shake(wrapper);
    // ── State guard after shake await ──────────────────────────────────
    if (_overlayState !== 'revealing') return;
  }

  const duration = isSuspense ? 600 : 300;
  inner.style.transitionDuration = duration + 'ms';
  // Phase 5.6 — flip whoosh fires the instant the spin starts so the audio
  // peak coincides with the card's mid-rotation visual peak.
  playCardFlip();
  inner.classList.add('overlay-flipped');

  await _wait(duration);
  // ── State guard after flip await ────────────────────────────────────
  if (_overlayState !== 'revealing') return;

  // Activate post-flip card-surface effects only while still in reveal mode.
  wrapper.classList.remove(
    'glow-common', 'glow-rare', 'glow-epic', 'glow-legendary', 'legendary-pulse',
    'reverse-holo-highlight', 'reverse-holo-active'
  );

  // Phase 5.2.1 — flip on .reverse-holo-active so the foil layers begin
  // animating now (post-flip) instead of from card-back time.
  if (isReverseHolo) {
    wrapper.classList.add('reverse-holo-active');
  }

  // Phase 5.5 — premium reveal effects. Triggers AFTER the flip lands so the
  // burst/sparkles read as a celebration of the reveal rather than overlapping
  // the spin. Tier-scaled (per spec Section 6/8):
  //   doubleRare / illustrationRare       → burst only
  //   ultraRare                           → burst + sparkles
  //   specialIllustrationRare / hyperRare → burst + sparkles + background glow
  // All elements append to the wrapper and self-clean via setTimeout so we
  // never leak DOM nodes if the user opens many packs in a row. Effects skip
  // entirely on reverse-holos (they have their own foil-sweep celebration)
  // and on commons / uncommons / plain rares.
  if (!isReverseHolo) {
    const BURST_TIERS = new Set([
      'doubleRare', 'illustrationRare',
      'ultraRare', 'specialIllustrationRare', 'hyperRare',
    ]);
    const SPARKLE_TIERS = new Set([
      'ultraRare', 'specialIllustrationRare', 'hyperRare',
    ]);
    const BG_TIERS = new Set([
      'specialIllustrationRare', 'hyperRare',
    ]);

    const tier = wrapper.dataset.renderTier;
    const capabilities = getTierCapabilities(tier);

    if (BURST_TIERS.has(realRarity) && capabilities.particles) {
      const burst = document.createElement('div');
      burst.className = 'reveal-burst';
      wrapper.appendChild(burst);
      setTimeout(() => burst.remove(), 900);
    }
    if (SPARKLE_TIERS.has(realRarity) && capabilities.particles) {
      _spawnSparkles(wrapper);
    }
    if (BG_TIERS.has(realRarity) && capabilities.holo) {
      const bg = document.createElement('div');
      bg.className = 'reveal-background';
      wrapper.appendChild(bg);
      setTimeout(() => bg.remove(), 1200);
    }

    // Phase 5.6 — tier-scaled audio cue. Ultra+ gets the bass-thump impact,
    // anything else holo-worthy gets the lighter chime. Commons/uncommons
    // and reverse-holos stay silent (the flip whoosh above is enough).
    const ULTRA_AUDIO = new Set(['ultraRare', 'specialIllustrationRare', 'hyperRare']);
    const CHIME_AUDIO = new Set(['rare', 'holoRare', 'doubleRare', 'illustrationRare']);
    if (ULTRA_AUDIO.has(realRarity))      playUltraHit();
    else if (CHIME_AUDIO.has(realRarity)) playRareChime();
  }

  // Phase 5.4 — activate interactive tilt on the revealed card. We only wire
  // listeners AFTER the flip completes so tilting doesn't expose seams on the
  // mystery back-face during the suspense window.
  _applyCardTilt(wrapper);
}

/**
 * Phase 5.5 — Spawn 14 sparkle particles radiating outward from the card
 * center. Each particle uses CSS custom properties --dx/--dy as the animation
 * end-point and self-removes after 1.6s (matches sparkleFloat duration).
 * @param {HTMLElement} container — the .overlay-card-wrapper to spawn into
 */
function _spawnSparkles(container) {
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'sparkle';
    const dx = (Math.random() - 0.5) * 220;
    const dy = (Math.random() - 0.5) * 220;
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.left = '50%';
    p.style.top  = '50%';
    container.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

/**
 * Slide the current card off-screen to the left, then clear the container.
 * @returns {Promise<void>}
 */
export function slideOutCard(direction = 'left') {
  console.log("ANIMATOR DIRECTION:", direction);
  if (!_currentCard) return Promise.resolve();
  const { wrapper } = _currentCard;
  // Phase 5.4 — clear any inline tilt transform left by _applyCardTilt so the
  // .slide-out-left class transform is what actually animates. Inline styles
  // beat class styles in specificity, so without this the card would freeze
  // mid-tilt instead of sliding off-screen.
  wrapper.style.transform = '';
  return new Promise((resolve) => {
    console.log("ANIMATION CLASS:", direction === 'right' ? 'slide-out-right' : 'slide-out-left');
    const className = direction === 'right' ? 'slide-out-right' : 'slide-out-left';
    wrapper.classList.add(className);
    setTimeout(() => {
      if (holoController && wrapper) holoController.unregisterCard(wrapper);
      if (_container) _container.innerHTML = '';
      _currentCard = null;
      resolve();
    }, 260);
  });
}

/**
 * Clear the container immediately (no animation).
 */
export function clearCard() {
  if (_currentCard && _currentCard.wrapper && holoController) {
    holoController.unregisterCard(_currentCard.wrapper);
  }
  if (_container) _container.innerHTML = '';
  _currentCard = null;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _shake(element) {
  return new Promise((resolve) => {
    element.classList.add('overlay-shake');
    setTimeout(() => {
      element.classList.remove('overlay-shake');
      resolve();
    }, 420);
  });
}

// ─── Phase 5.4 — interactive holographic tilt ───────────────────────────────
//
// Wires pointer-driven 3D tilt onto the card wrapper. The wrapper is the
// safe tilt target because the INNER element already owns the flip
// transform (rotateY 180deg). preserve-3d on the wrapper keeps the
// inner-flip composing correctly inside the tilted parent.
//
// Listeners self-clean: the wrapper is removed from the DOM by
// slideOutCard() / clearCard(), which detaches its event listeners with it.
//
// Caps rotation at ±10° per the design spec ("subtle, like real foil").
//
function _applyCardTilt(wrapper) {
  if (!wrapper) return;

  if (!holoController) {
    holoController = new HoloController(wrapper);
  }

  holoController.registerCard(wrapper);
}
