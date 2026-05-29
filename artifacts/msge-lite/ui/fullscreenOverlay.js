/**
 * ui/fullscreenOverlay.js
 * Orchestrates the fullscreen mobile pack-opening experience.
 *
 * Overlay state machine
 *   'idle'      — overlay closed, no pack active
 *   'revealing' — cards are being revealed one by one
 *   'summary'   — skip pressed; summary tiles visible, waiting for tap
 *
 * Phase 4.4.3: Rarity symbols use Unicode text + CSS descendant selectors for
 * premium styling.  SVG icon approach removed — no more color:transparent issue
 * that made premium SVG icons invisible inside gradient containers.
 */

import { attachSwipeController } from './swipeController.js';
import { updatePendingSessionIndex } from '../data/pendingPackManager.js';

import {
  initAnimator,
  setOverlayState,
  showMystery,
  revealCard,
  slideOutCard,
  clearCard,
} from './cardRevealAnimator.js';
import { RARITY_ICONS, RARITY_ICON_FALLBACK } from './rarityIcons.js';

// ─── DOM references ────────────────────────────────────────────────────────────

function overlay()   { return document.getElementById('pack-overlay'); }
function cardStage() { return document.getElementById('overlay-card-stage'); }
function counterEl() { return document.getElementById('overlay-counter'); }
function hintEl()    { return document.getElementById('overlay-hint'); }
function statusEl()  { return document.getElementById('overlay-status'); }
function skipBtn()   { return document.getElementById('overlay-skip-btn'); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function setCounter(current, total) {
  const el = counterEl();
  if (!el) return;
  el.textContent = (current !== '') ? `Card ${current} / ${total}` : '';
}

function setHint(text) {
  const el = hintEl();
  if (el) el.textContent = text;
}

/** Set plain-text status (pack label, completion message). */
function setStatus(text, cls = '') {
  const el = statusEl();
  if (!el) return;
  el.textContent = text;
  el.className = 'overlay-status ' + cls;
}

/**
 * Set the overlay status to the SVG rarity icon for the revealed card.
 * Uses explicit hex fills — visible regardless of parent color:transparent.
 */
function setRarityStatus(rarity) {
  const el = statusEl();
  if (!el) return;
  el.innerHTML = RARITY_ICONS[rarity] ?? RARITY_ICON_FALLBACK;
  el.className = `overlay-status overlay-rarity-${rarity}`;
}

/**
 * Phase 5.2.5 — Show or hide the "Reverse Holo" caption as a flex-flow sibling
 * directly below the rarity diamond. Rendered only after a reverse-holo card
 * is revealed; cleared when the next card's back appears or the pack ends.
 *
 * Lazily creates the DOM node on first use so index.html stays untouched.
 *
 * @param {boolean} show
 */
function setReverseHoloLabel(show) {
  const status = statusEl();
  if (!status) return;
  let label = document.getElementById('overlay-rh-label');

  if (!show) {
    if (label) label.remove();
    return;
  }

  if (!label) {
    label = document.createElement('div');
    label.id = 'overlay-rh-label';
    label.className = 'reverse-holo-label';
    label.textContent = 'Reverse Holo';
    status.insertAdjacentElement('afterend', label);
  }
}

/**
 * Returns a Promise that resolves only after a COMPLETE fresh tap.
 */
function waitForTap(el) {
  return new Promise((resolve) => {
    let pointerDownSeen = false;
    let startX = 0;
    let startY = 0;

    function onDown(e) {
      pointerDownSeen = true;
      startX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
      startY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    }

    function onUp(e) {
      if (!pointerDownSeen) return;
      const x  = e.clientX ?? (e.changedTouches?.[0]?.clientX ?? 0);
      const y  = e.clientY ?? (e.changedTouches?.[0]?.clientY ?? 0);
      const dx = Math.abs(x - startX);
      const dy = Math.abs(y - startY);
      if (dx < 12 && dy < 12) {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointerup',   onUp);
        pointerDownSeen = false;
        resolve();
      }
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup',   onUp);
  });
}

// ─── Rarity helpers ───────────────────────────────────────────────────────────

const KNOWN_RARITIES = new Set([
  'common', 'uncommon', 'rare', 'holoRare', 'doubleRare',
  'illustrationRare', 'ultraRare', 'specialIllustrationRare', 'hyperRare',
]);

const HIGH_RARITY = new Set([
  'holoRare', 'doubleRare', 'illustrationRare',
  'ultraRare', 'specialIllustrationRare', 'hyperRare',
]);

function safeRarity(card) {
  const r = card?.rarity;
  return KNOWN_RARITIES.has(r) ? r : 'common';
}

// ─── Skip summary ─────────────────────────────────────────────────────────────

/**
 * Replace the card stage with a 2-row × 5-column grid of all 10 cards.
 * Cards with images show thumbnails; others show a Unicode rarity symbol.
 * The rarity-${rarity} class on each badge activates premium CSS rules.
 *
 * @param {Object[]} allCards — full pack array (10 cards)
 */
function showSkipSummary(allCards) {
  const ov    = overlay();
  const stage = cardStage();
  if (!stage) return;

  if (ov) ov.classList.add('overlay-summary-mode');
  stage.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'skip-summary-container';

  for (const card of allCards) {
    const rarity = safeRarity(card);
    const badge  = document.createElement('div');
    badge.className = `skip-summary-card rarity-summary-${rarity}`;

    if (card.imageUrl) {
      badge.innerHTML = `<img class="skip-summary-img" src="${card.imageUrl}" alt="${card.name ?? rarity}" loading="eager" />`;
    } else {
      badge.innerHTML = `
        ${RARITY_ICONS[rarity] ?? RARITY_ICON_FALLBACK}
        <span class="skip-summary-rarity rarity-label">${rarity}</span>
      `;
    }

    container.appendChild(badge);
  }

  stage.appendChild(container);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function openPackOverlay(cards, packNumber, startIndex = 0) {
  return new Promise((resolve) => {
    const ov    = overlay();
    const stage = cardStage();
    if (!ov || !stage) { resolve(); return; }

    const hasSuspense = cards.some((c) => HIGH_RARITY.has(c.rarity));

    // Targeted preload: ensure pack reveal images are warmed and decoded
    // to avoid Safari PWA hydration failures on the flip moment.
    (async function preloadRevealImages() {
      if (!cards || cards.length === 0) return;
      const toPreload = cards
        .map(c => c.imageUrl)
        .filter(Boolean)
        .slice(0, 20); // defensive cap

      const promises = toPreload.map((src) => new Promise((res) => {
        try {
          const img = new Image();
          let settled = false;
          const finish = () => { if (!settled) { settled = true; res(); } };
          img.onload = async () => {
            if (img.decode) {
              try { await img.decode(); } catch (e) { /* ignore decode errors */ }
            }
            finish();
          };
          img.onerror = finish;
          // small timeout so a hung request doesn't block the overlay
          setTimeout(finish, 1500);
          img.src = src;
        } catch (e) { res(); }
      }));

      // Start animator immediately but let preloads run; awaiting here keeps
      // the code path resilient while biasing for readiness before reveals.
      Promise.all(promises).catch(() => {});
    })();

    initAnimator(stage);

    let state = 'revealing';

    setOverlayState('revealing');
    ov.classList.remove('overlay-hidden');
    ov.classList.add('overlay-visible');
    setStatus(`Pack #${packNumber}`, 'overlay-pack-label');
    setHint('');

    let cardIndex = startIndex;
    let revealed  = false;
    let busy      = false;
    let done      = false;

    showCurrentBack();

    const { cleanup: removeGestures } = attachSwipeController(ov, {
      onSwipeLeft: handleAdvance,
      onTap:       handleAdvance,
    });

    const skip = skipBtn();

    const absorbSkipEvents = (e) => e.stopPropagation();
    if (skip) {
      skip.addEventListener('touchstart',  absorbSkipEvents, { passive: true });
      skip.addEventListener('touchend',    absorbSkipEvents, { passive: true });
      skip.addEventListener('pointerdown', absorbSkipEvents);
      skip.addEventListener('pointerup',   absorbSkipEvents);
      skip.addEventListener('click', handleSkip);
    }

    function handleSkip() {
      if (done) return;
      state = 'summary';
      setOverlayState('summary');
      done = true;
      busy = true;
      finishPack(true);
    }

    async function handleAdvance() {
      if (busy || done) return;
      busy = true;
      if (!revealed) {
        await doReveal();
      } else {
        await goToNext();
      }
      busy = false;
    }

    async function doReveal() {
      revealed = true;
      setHint('');

      const card = cards[cardIndex];
      const isSuspenseCard = HIGH_RARITY.has(card.rarity);
      await revealCard(
        card.rarity,                          // engine 4-tier — drives glow/pulse class
        isSuspenseCard && hasSuspense,
        card.imageUrl ?? null,
        card.isReverseHolo === true,          // Phase 5.2 — pipe foil flag through to animator
        card.rarityType ?? card.rarity,       // Phase 5.4.3 — REAL Pokémon rarity gates the holo
      );

      if (done) return;

      // Unicode symbol with rarity-${rarity} class activates premium CSS rule
      setRarityStatus(card.rarity);
      // Phase 5.2.5 — show the reverse-holo caption below the rarity diamond.
      setReverseHoloLabel(card.isReverseHolo === true);
      setHint(cardIndex < cards.length - 1
        ? 'Swipe or tap to reveal next card'
        : 'Tap to finish');
    }

    async function goToNext() {
      cardIndex++;
      updatePendingSessionIndex(cardIndex);
      if (cardIndex >= cards.length) {
        if (state === 'summary') return;
        await finishPack(false);
        return;
      }
      await slideOutCard();
      await wait(80);

      if (done) return;

      showCurrentBack();
    }

    function showCurrentBack() {
      revealed = false;
      const card = cards[cardIndex];
      const isSuspenseCard = HIGH_RARITY.has(card.rarity);
      showMystery(hasSuspense && isSuspenseCard);
      setCounter(cardIndex + 1, cards.length);
      setStatus(`Pack #${packNumber}`, 'overlay-pack-label');
      setReverseHoloLabel(false);   // Phase 5.2.5 — clear any prior RH caption
      setHint('Swipe or tap to reveal next card');
    }

    async function finishPack(isSkip = false) {
      if (!isSkip && (done || state === 'summary')) return;
      if (!isSkip) done = true;

      if (skip) skip.removeEventListener('click', handleSkip);

      clearCard();
      setCounter('', '');
      setReverseHoloLabel(false);   // Phase 5.2.5 — never leak between packs
      setHint('');

      if (isSkip) {
        await wait(60);
        if (state !== 'summary') return;
        showSkipSummary(cards);
        setHint('Tap anywhere to continue');
        await waitForTap(ov);
      } else {
        setStatus('Pack Complete', 'overlay-complete');
        await wait(1400);
        if (state === 'summary') return;
      }

      state = 'idle';
      ov.classList.remove('overlay-summary-mode');
      ov.classList.remove('overlay-visible');
      ov.classList.add('overlay-hidden');

      if (skip) skip.style.display = '';

      await wait(300);

      setOverlayState('idle');

      if (skip) {
        skip.removeEventListener('touchstart',  absorbSkipEvents);
        skip.removeEventListener('touchend',    absorbSkipEvents);
        skip.removeEventListener('pointerdown', absorbSkipEvents);
        skip.removeEventListener('pointerup',   absorbSkipEvents);
      }

      removeGestures();
      resolve();
    }
  });
}
