import { playCardFlip, playRareChime, playUltraHit } from './audioManager.js';

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
 * @returns {{ wrapper, inner, frontFace, backFace }}
 */
function buildCard(container) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'overlay-card-wrapper';

  const inner = document.createElement('div');
  inner.className = 'overlay-card-inner';

  const frontFace = document.createElement('div');
  frontFace.className = 'overlay-card-face overlay-card-front';

  const backFace = document.createElement('div');
  backFace.className = 'overlay-card-face overlay-card-back-face';

  inner.appendChild(frontFace);
  inner.appendChild(backFace);
  wrapper.appendChild(inner);
  container.appendChild(wrapper);

  return { wrapper, inner, frontFace, backFace };
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

  if (imageUrl) {
    // Defensive image load: append only after onload/decode; onerror -> fallback
    backFace.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'card-reveal-img';
    img.loading = 'eager';
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
        // Fix: Do not destroy holo layers that were appended synchronously.
        // Instead of clearing backFace.innerHTML, prepend the image so it sits under the overlays.
        const existingArt = backFace.querySelector('.card-reveal-art');
        if (existingArt) existingArt.remove();
        backFace.insertBefore(img, backFace.firstChild);
      }
    };
    img.onerror = () => {
      if (settled) return; settled = true;
      if (backFace && backFace.parentNode) {
        const existingImg = backFace.querySelector('.card-reveal-img');
        if (existingImg) existingImg.remove();
        let existingArt = backFace.querySelector('.card-reveal-art');
        if (!existingArt) {
          existingArt = document.createElement('div');
          existingArt.className = 'card-reveal-art';
          existingArt.innerHTML = `<span class="card-reveal-symbol">${RARITY_SYMBOL[rarity] ?? '?'}</span><span class="card-reveal-rarity">${RARITY_LABEL[rarity] ?? rarity}</span>`;
          backFace.insertBefore(existingArt, backFace.firstChild);
        }
      }
    };
    // Non-blocking timeout: if the image doesn't load quickly, fall back to symbol
    const t = setTimeout(() => { if (!settled) img.onerror(); }, 1800);
    img.addEventListener('loadend' in img ? 'loadend' : 'load', () => clearTimeout(t));
    img.src = imageUrl;
  } else {
    backFace.innerHTML = `
      <div class="card-reveal-art">
        <span class="card-reveal-symbol">${RARITY_SYMBOL[rarity] ?? '?'}</span>
        <span class="card-reveal-rarity">${RARITY_LABEL[rarity] ?? rarity}</span>
      </div>
    `;
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
  if (!isReverseHolo && HOLO_RARITIES.has(rarityForHolo)) {
    const rainbow = document.createElement('div');
    rainbow.className = 'holo-rainbow';
    const reflection = document.createElement('div');
    reflection.className = 'holo-reflection';
    backFace.appendChild(rainbow);
    backFace.appendChild(reflection);

    // Phase 5.4.4 — tier-scaled edge halo. Adds a class on the back face so a
    // user catching the card from the corner of their eye can tell it's a
    // higher-tier pull just from the surrounding glow color/intensity.
    //   silver  → rare, holoRare           (subtle white-blue rim)
    //   gold    → doubleRare, illustration (warm gold rim)
    //   rainbow → ultraRare, special, hyper (intense chromatic rim + pulse)
    const TIER = {
      rare:                   'silver',
      holoRare:               'silver',
      doubleRare:             'gold',
      illustrationRare:       'gold',
      ultraRare:              'rainbow',
      specialIllustrationRare:'rainbow',
      hyperRare:              'rainbow',
    };
    const tier = TIER[rarityForHolo];
    if (tier) backFace.classList.add(`holo-tier-${tier}`);
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
  _currentCard.backFace.innerHTML = '';
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

  // Apply post-flip glow/pulse only while still in reveal mode
  wrapper.classList.remove(
    'glow-common', 'glow-rare', 'glow-epic', 'glow-legendary', 'legendary-pulse',
    'reverse-holo-highlight', 'reverse-holo-active'
  );
  wrapper.classList.add(`glow-${rarity}`);
  if (rarity === 'legendary') wrapper.classList.add('legendary-pulse');

  // Phase 5.2 — reverse-holo wrapper glow (subtle; weaker than legendary pulse).
  // Phase 5.2.1 — also flip on .reverse-holo-active so the foil layers begin
  // animating now (post-flip) instead of from card-back time.
  if (isReverseHolo) {
    wrapper.classList.add('reverse-holo-highlight');
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
  // and on commons / uncommons / plain rares (those keep the edge-halo only).
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

    if (BURST_TIERS.has(realRarity)) {
      const burst = document.createElement('div');
      burst.className = 'reveal-burst';
      wrapper.appendChild(burst);
      setTimeout(() => burst.remove(), 900);
    }
    if (SPARKLE_TIERS.has(realRarity)) {
      _spawnSparkles(wrapper);
    }
    if (BG_TIERS.has(realRarity)) {
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
export function slideOutCard() {
  if (!_currentCard) return Promise.resolve();
  const { wrapper } = _currentCard;
  // Phase 5.4 — clear any inline tilt transform left by _applyCardTilt so the
  // .slide-out-left class transform is what actually animates. Inline styles
  // beat class styles in specificity, so without this the card would freeze
  // mid-tilt instead of sliding off-screen.
  wrapper.style.transform = '';
  return new Promise((resolve) => {
    wrapper.classList.add('slide-out-left');
    setTimeout(() => {
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
  const MAX_DEG = 10;

  // Phase 5.4.3 — initialize the holo CSS vars to centered so the iridescent
  // bands and spotlight render properly at rest (before any pointer activity).
  wrapper.style.setProperty('--holo-x', '50%');
  wrapper.style.setProperty('--holo-y', '50%');

  const setTilt = (clientX, clientY) => {
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const fx = x / rect.width;
    const fy = y / rect.height;
    const rotateY = (fx - 0.5) * (MAX_DEG * 2);
    const rotateX = (0.5 - fy) * (MAX_DEG * 2);
    wrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    // Phase 5.4.3 — drive the holo spotlight + band shift via CSS vars so the
    // reflection physically tracks the pointer like a real foil card.
    wrapper.style.setProperty('--holo-x', `${fx * 100}%`);
    wrapper.style.setProperty('--holo-y', `${fy * 100}%`);
  };

  const resetTilt = () => {
    wrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
    wrapper.style.setProperty('--holo-x', '50%');
    wrapper.style.setProperty('--holo-y', '50%');
  };

  wrapper.addEventListener('mousemove', (e) => setTilt(e.clientX, e.clientY));
  wrapper.addEventListener('mouseleave', resetTilt);

  // Touch — do NOT preventDefault; the overlay's swipe-to-next-card handler
  // also listens on touch and needs the events to bubble through.
  wrapper.addEventListener('touchmove', (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    setTilt(t.clientX, t.clientY);
  }, { passive: true });
  wrapper.addEventListener('touchend',   resetTilt);
  wrapper.addEventListener('touchcancel', resetTilt);
}
