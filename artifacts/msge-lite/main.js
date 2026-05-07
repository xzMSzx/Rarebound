/**
 * main.js — Phase 9: Vendor Economy
 *
 * Phase 9 additions:
 *  - Four-vendor hub (PokéMart, Retro Vault, Night Market, The Broker)
 *  - Per-vendor favor (1–5) with discount + holo bonus
 *  - Global Collector Reputation with rank progression
 *  - Selling system with auto-lock on first copies + commission table
 *  - Dynamic market values that drift on every refresh tick
 *  - Daily refresh cycle (30 min in dev) with trend rotation
 *  - Trend ticker + refresh timer in top bar
 *  - Broker time gate (Fri–Sun only)
 *  - Toast notifications for favor / reputation gains
 *
 * DO NOT modify: packSimulation, RNG/pity, rarity systems, reveal animations,
 * audio, or pack opening flow.
 */

import { inject } from '@vercel/analytics';

import { createPackSimulation }    from './simulations/packSimulation.js';
import { openPackOverlay }         from './ui/fullscreenOverlay.js';
import { initMobileLayoutManager } from './ui/mobileLayoutManager.js';
import {
  loadSet, getRandomCard, isSetLoaded, getCurrentSetId, getCachedSetCards,
} from './data/cardPoolManager.js';
import { mapPokemonRarity }        from './data/rarityMapper.js';
import { openPackInteraction }     from './ui/packOpeningController.js';
import { setCurrentSet }           from './data/setProbabilityTables.js';
import { PACK_STORE }              from './data/packStore.js';
import {
  loadPlayerState, getBalance, spendBalance, addCard, addBalance,
} from './state/playerState.js';
import {
  getCollection, addCardToCollection, getOwnedEntry,
  isLocked, unlockCard,
} from './data/collectionManager.js';
import { getMarketValue, getAllMarketValues, enrichMarketMeta } from './data/marketValue.js';
import { isWishlisted, toggleWishlist, getWishlist } from './data/wishlistManager.js';
import {
  initEconomy, getCurrentTrend, getRefreshLabel, runRefresh, timeUntilRefreshMs,
  tryGenerateDailyChase,
} from './data/economyManager.js';
import {
  VENDORS, getVendorStock, getFavor, addFavor, getFavorLevel, getFavorProgress,
  isVendorOpen, getBrokerNextOpenLabel, getEffectivePackPrice,
} from './data/vendorManager.js';
import { getReputation, addReputation, getRank } from './data/reputationManager.js';
import { calculateSellPayout, isSellGated, sellCard }    from './data/sellingManager.js';
import { lockBodyScroll, unlockBodyScroll, getLockDepth } from './ui/scrollManager.js';
import {
  getDailyChase, getChaseBoost, isChaseCard,
  getBrokerInventory, removeBrokerPick,
} from './data/chaseManager.js';
import { getHistory, getMovementPct } from './data/marketHistory.js';
import { canClaim as canClaimStipend, getStipendAmount, getCountdownLabel as stipendCountdown, claimStipend } from './data/stipendManager.js';
import { recordHit, getRecentHits } from './data/recentHits.js';
import { openMarketScreen } from './ui/marketScreen.js';
import { applyReducedMotion } from './data/settingsManager.js';
import { haptic } from './data/hapticManager.js';
import { showBootScreen, runBootSequence } from './ui/bootScreen.js';
import { setSettingsHooks } from './ui/settingsScreen.js';
import { initUtilityDock } from './ui/utilityDock.js';
import { isInfiniteBalance, isSandboxMode } from './data/devAccess.js';
import {
  getBoxesForVendor, getBoxById, rollBoxContents,
} from './data/mysteryBoxManager.js';
import { showMysteryBoxReveal } from './ui/mysteryBoxOverlay.js';
import {
  setVendorAmbient, sfx, refreshAmbientFromSettings, unlockAudioContext,
  getAudioContextState,
} from './data/ambientAudioManager.js';
import { wasFreshLaunch } from './state/playerState.js';
import { DEBUG_FLAGS, isDebugMode, isDebugFromUrl, logActiveFlags, mountDebugTapButton } from './data/debugFlags.js';
import { isDiagFlag, initDiagnosticsFromStorage } from './data/diagnosticsManager.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Initialize Vercel Web Analytics
inject();

// Phase 10.2: diagnostics only in debug mode (?debug=1, window.__RAREBOUND_DEBUG__,
// or any isolation flag). Normal production users see a clean console.
if (isDebugMode()) logActiveFlags();
// Phase 10.3: URL-flag debug tap only — persistent-diagnostics tap managed
// later by initDiagnosticsFromStorage() once the app is fully ready.
if (isDebugFromUrl()) mountDebugTapButton();

// Phase 10.3: expose stat helpers for the diagnostics overlay (no circular deps).
window.__diag_getLockDepth     = getLockDepth;
window.__diag_getAudioCtxState = getAudioContextState;

// Boot screen first — appears before any interactive system, blocks the
// Vendor Hub from input until preload completes.
// Phase 10.1.8: when ?noboot=1 is set, skip the boot screen entirely so the
// Vendor Hub renders immediately with no boot-locked class on body.
if (!DEBUG_FLAGS.noBoot) {
  showBootScreen();
} else {
  const _bootEl = document.getElementById('boot-screen');
  if (_bootEl) _bootEl.style.display = 'none';
  document.body.classList.remove('boot-locked');
}
applyReducedMotion();

// Phase 10.1.8: when ?nooverlays=1 is set, REMOVE the four overlay/modal nodes
// from the DOM. Callers that try to open them later hit the existing
// `if (!modal) return` null guards and silently no-op.
if (DEBUG_FLAGS.noOverlays) {
  ['card-detail-modal', 'sell-modal', 'settings-screen', 'help-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

initMobileLayoutManager();
const engine = createPackSimulation();

// Synchronous local-storage hydration — cheap, must run before the
// top-level Vendor Hub renders below. The boot screen still narrates
// these stages for premium feel; heavy async work (pack preload + binder
// hydration) is what actually gates the boot screen's exit.
loadPlayerState();
initEconomy();

// ─── Card augmentation (unchanged) ────────────────────────────────────────────

function augmentCards(engineCards, setId) {
  if (!isSetLoaded()) return engineCards;
  return engineCards.map((card) => {
    const poolCard = getRandomCard(card.rarity);
    if (!poolCard) return card;
    return { ...card, id: poolCard.id || null, setId, name: poolCard.name,
             imageUrl: poolCard.imageUrl, rarityType: poolCard.rarity };
  });
}

const CARD_BACK_URL = 'https://images.pokemontcg.io/cardback.png';
new Image().src = CARD_BACK_URL;

// ─── Background preload (Phase 10 — orchestrated by boot screen) ─────────────

const SET_IDS = ['swsh7', 'sv4pt5', 'sv3pt5', 'sv2', 'swsh11'];

function preloadAllSetsAsync() {
  // Stagger requests slightly to avoid hammering the API in one burst.
  // Each set gets a 7s individual timeout and the whole batch caps at 12s
  // so a hanging fetch (no TCP error, just no response) never blocks the
  // boot screen from completing and removing boot-locked from the body.
  const TIMEOUT_PER_SET_MS = 7000;
  const TIMEOUT_TOTAL_MS   = 12000;

  const perSet = (setId, i) => new Promise(resolve => {
    const timer = setTimeout(resolve, TIMEOUT_PER_SET_MS + i * 250);
    setTimeout(() => {
      loadSet(setId)
        .then(() => { clearTimeout(timer); resolve(); })
        .catch(() => { clearTimeout(timer); resolve(); });
    }, i * 250);
  });

  return Promise.race([
    Promise.all(SET_IDS.map(perSet)),
    new Promise(resolve => setTimeout(resolve, TIMEOUT_TOTAL_MS)),
  ]);
}

async function hydrateChaseSystemsAsync() {
  // Wait briefly for at least one set's cached cards to be available.
  for (let attempts = 0; attempts < 12; attempts++) {
    const anyLoaded = SET_IDS.some(id => (getCachedSetCards(id) || []).length > 0);
    if (anyLoaded) break;
    await new Promise(r => setTimeout(r, 200));
  }
  tryGenerateDailyChase();
  getBrokerInventory();
  renderChaseStrip();
  renderVendorHub();
}

window.addEventListener('load', () => {
  runBootSequence({
    // First three stages are narrated only — the underlying state was
    // hydrated synchronously above so the Vendor Hub already had data
    // to render. Stage labels still progress for premium continuity.
    restoreCollection: () => {},
    syncVendors:       () => {},
    loadMarket:        () => {},
    preloadPacks:      () => preloadAllSetsAsync(),
    hydrateBinders:    () => hydrateChaseSystemsAsync(),
    finalizeEconomy:   () => {
      updateBalanceUI();
      updateMarketStrip();
      updateRankStrip();
      renderStipendStrip();
      renderRecentHits();
      renderVendorHub();
      syncDevBadge();
      // First-launch starter grant toast (only shown on a brand-new save)
      if (wasFreshLaunch()) {
        setTimeout(() => {
          showToast('Starter Collector Grant: $120', 'sell');
        }, 600);
      }
      // If the user previously enabled ambient audio, gently start it
      // on the default vendor so the boot fade lands on something alive.
      refreshAmbientFromSettings();
    },
  }).then(() => {
    // Safety valve: ensure boot-locked is removed even if hideBootScreen() had
    // any issue (e.g. bootEl null on a hot-reload).  Idempotent — classList.remove
    // on an absent class is a no-op.
    document.body.classList.remove('boot-locked');

    // Phase 10.3: GlobalClick + NavAudit — gated by navAudit sub-flag.
    if (isDebugMode() && isDiagFlag('navAudit')) {
      document.addEventListener('click', (e) => {
        if (['BUTTON','A'].includes(e.target?.tagName) || e.target?.id) {
          console.log(
            '[GlobalClick]', e.target?.tagName, `#${e.target?.id || '-'}`,
            '| defaultPrevented:', e.defaultPrevented,
            '| cancelable:', e.cancelable,
            '| phase:', e.eventPhase,
          );
        }
      }, true);

      setTimeout(() => {
        [
          { sel: '#view-collection-btn', label: 'My Collection' },
          { sel: '#market-btn',          label: 'Market' },
          { sel: '#stats-btn',           label: 'Stats' },
        ].forEach(({ sel, label }) => {
          const btn = document.querySelector(sel);
          if (!btn) { console.warn('[NavAudit] button not found:', sel); return; }
          const r   = btn.getBoundingClientRect();
          const cx  = Math.round((r.left + r.right)  / 2);
          const cy  = Math.round((r.top  + r.bottom) / 2);
          const hit = document.elementFromPoint(cx, cy);
          const cs  = hit ? window.getComputedStyle(hit) : null;
          console.log(
            `[NavAudit] ${label} @ (${cx},${cy}):`,
            hit === btn ? '✅ direct hit' : '❌ intercepted by',
            hit?.tagName, `#${hit?.id || '-'}`,
            (hit?.className?.toString() || '').slice(0, 70),
            '| z-index:', cs?.zIndex,
            '| pointer-events:', cs?.pointerEvents,
            '| display:', cs?.display,
            '| visibility:', cs?.visibility,
          );
        });
      }, 2000);
    }

    // Phase 10.3: restore persistent diagnostics overlay + debug tap from storage.
    initDiagnosticsFromStorage();
  });
});

// ─── Corner icons (Phase 10) ─────────────────────────────────────────────────

// Utility dock replaces the previous floating Settings + Help icons.
initUtilityDock();
setSettingsHooks({
  onBalanceChanged:   () => updateBalanceUI(),
  onVendorsChanged:   () => renderVendorHub(),
  onMarketRefreshed:  () => { updateMarketStrip(); renderVendorHub(); renderChaseStrip(); },
  onReputationReset:  () => updateRankStrip(),
  onInfiniteToggled:  () => { syncDevBadge(); updateBalanceUI(); },
});

// Audio unlock: resume AudioContext on user gestures. The handler is
// idempotent and cheap — once successfully unlocked, subsequent calls
// short-circuit. Listener stays bound (no { once: true }) because if
// the first gesture happens while audio is disabled in Settings, we
// still want a later gesture to unlock once the user opts in.
// Phase 10.1.8: when ?noaudio=1 is set, attach NO global gesture listeners
// at all. This proves / disproves whether the audio-unlock chain (or the
// AudioContext.resume() side-effects on iOS) is interfering with click flow.
if (!DEBUG_FLAGS.noAudio) {
  ['pointerdown', 'keydown', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, unlockAudioContext, { passive: true })
  );
}

// Mount subtle ambient gradient drift behind the hub
(function ensureHubDrift() {
  if (document.querySelector('.hub-ambient-drift')) return;
  const drift = document.createElement('div');
  drift.className = 'hub-ambient-drift';
  document.body.prepend(drift);
})();

function syncDevBadge() {
  const badge = document.getElementById('dev-badge');
  if (!badge) return;
  badge.classList.toggle('hidden', !isInfiniteBalance());
}
syncDevBadge();

// ─── Screen transitions ──────────────────────────────────────────────────────

function showScreen(screen) {
  if (!screen) {
    console.error('[Nav] showScreen() called with null — check getElementById(). Stack:', new Error().stack);
    return;
  }
  screen.style.display = 'flex';
  requestAnimationFrame(() => screen.classList.remove('hidden'));
}
function hideScreen(screen) {
  if (!screen) {
    console.error('[Nav] hideScreen() called with null — check getElementById(). Stack:', new Error().stack);
    return;
  }
  screen.classList.add('hidden');
  setTimeout(() => {
    if (screen.classList.contains('hidden')) screen.style.display = 'none';
  }, 240);
}

(function initScreens() {
  // settings-screen and help-screen are intentionally included here even though
  // they start with class="hidden" in HTML. Their .screen CSS gives them
  // position:fixed; inset:0; z-index:100; display:flex by default — without
  // display:none they sit as full-viewport composited layers above #store-screen
  // (which has no z-index). On iOS Safari, touch-action:pan-y on those layers
  // can absorb tap-start gestures at the native gesture level before
  // pointer-events:none filtering applies, making the nav buttons appear dead.
  ['collection-screen','binder-screen','card-detail-modal','stats-screen',
   'wishlist-screen','sell-modal','market-screen','market-graph-modal',
   'settings-screen','help-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
  });
})();

// ─── Pack loading indicator ───────────────────────────────────────────────────

const showPackLoadingIndicator = () => document.getElementById('pack-loading-indicator')?.classList.remove('hidden');
const hidePackLoadingIndicator = () => document.getElementById('pack-loading-indicator')?.classList.add('hidden');

// ─── Stats persistence ────────────────────────────────────────────────────────

const STATS_KEY = 'tcg_stats';
const getPacksOpened       = () => { try { return JSON.parse(localStorage.getItem(STATS_KEY))?.packsOpened || 0; } catch { return 0; } };
const incrementPacksOpened = () => localStorage.setItem(STATS_KEY, JSON.stringify({ packsOpened: getPacksOpened() + 1 }));

// ─── Rarity tables ────────────────────────────────────��───────────────────────

const RARITY_ORDER  = ['common','uncommon','rare','holoRare','doubleRare','illustrationRare','ultraRare','specialIllustrationRare','hyperRare'];
const RARITY_LABELS = {
  common:'Common', uncommon:'Uncommon', rare:'Rare', holoRare:'Holo Rare',
  doubleRare:'Double Rare', illustrationRare:'Illustration Rare', ultraRare:'Ultra Rare',
  specialIllustrationRare:'Special Illustration Rare', hyperRare:'Hyper Rare',
};
const PULL_RATES = {
  common:'~1 in 1 pack', uncommon:'~1 in 1 pack', rare:'~1 in 3 packs',
  holoRare:'~1 in 5 packs', doubleRare:'~1 in 12 packs', illustrationRare:'~1 in 48 packs',
  ultraRare:'~1 in 36 packs', specialIllustrationRare:'~1 in 120 packs', hyperRare:'~1 in 250 packs',
};
const SECRET_TIERS = new Set(['hyperRare','specialIllustrationRare']);

// ─── Toast notifications ──────────────────────────────────────────────────────

function showToast(text, kind = 'favor') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${kind}`;
  toast.textContent = text;
  container.appendChild(toast);
  // Auto-remove after animation
  setTimeout(() => toast.remove(), 2600);
}

// ─── Binder state ─────────────────────────────────────────────────────────────

const CARDS_PER_PAGE     = 9;
let _binderSetId         = null;
let _binderPage          = 0;
let _pendingHighlightId  = null;
const _binderPageMemory  = {};

// ─── Mystery box emblems (must be declared before renderVendorHub() runs) ─────
//
// Per-vendor emblem SVGs (inline, no external assets).
// HTML comments are intentionally omitted — embedding <!-- --> inside
// a template literal that feeds into innerHTML can confuse some HTML
// parsers (notably WebKit) and cause the trailing <button> to fall
// outside the tile subtree, making querySelector('.mystery-box-cta')
// return null and throwing on .onclick assignment.
//
// IMPORTANT: this const MUST live here, above the renderVendorHub() call at
// module scope below. `renderMysteryBoxTile` is a hoisted function declaration
// so it exists, but `const` bindings are NOT initialized until their declaration
// is reached — accessing BOX_EMBLEMS before this line throws a TDZ ReferenceError.
const BOX_EMBLEMS = {
  // Night Market — sealed hazard crate with lid and latch
  nightMarket: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="13" width="26" height="15" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 18 L31 18" stroke="currentColor" stroke-width="0.8" opacity="0.6"/><rect x="14" y="14.5" width="8" height="3.5" rx="1" stroke="currentColor" stroke-width="1"/><path d="M4 10 L18 6 L32 10" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" opacity="0.8"/><line x1="9" y1="13" x2="7" y2="18" stroke="currentColor" stroke-width="0.6" opacity="0.4"/><line x1="14" y1="13" x2="12" y2="18" stroke="currentColor" stroke-width="0.6" opacity="0.4"/><line x1="19" y1="13" x2="17" y2="18" stroke="currentColor" stroke-width="0.6" opacity="0.4"/><line x1="24" y1="13" x2="22" y2="18" stroke="currentColor" stroke-width="0.6" opacity="0.4"/><line x1="29" y1="13" x2="27" y2="18" stroke="currentColor" stroke-width="0.6" opacity="0.4"/></svg>`,
  // Retro Vault — brass archive case with combination lock
  retroVault:  `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="6" width="30" height="24" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M3 12 L33 12M3 24 L33 24" stroke="currentColor" stroke-width="0.8" opacity="0.55"/><circle cx="18" cy="18" r="5" stroke="currentColor" stroke-width="1.1"/><circle cx="18" cy="18" r="2.2" stroke="currentColor" stroke-width="0.9"/><line x1="7" y1="6" x2="7" y2="12" stroke="currentColor" stroke-width="1.4"/><line x1="29" y1="6" x2="29" y2="12" stroke="currentColor" stroke-width="1.4"/><line x1="7" y1="24" x2="7" y2="30" stroke="currentColor" stroke-width="1.4"/><line x1="29" y1="24" x2="29" y2="30" stroke="currentColor" stroke-width="1.4"/></svg>`,
  // Broker — concentric diamond insignia (luxury geometric mark)
  broker:      `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 3 L33 18 L18 33 L3 18 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 9 L27 18 L18 27 L9 18 Z" stroke="currentColor" stroke-width="0.9" opacity="0.65"/><path d="M18 14 L22 18 L18 22 L14 18 Z" stroke="currentColor" stroke-width="1.1"/><line x1="18" y1="3" x2="18" y2="9" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><line x1="33" y1="18" x2="27" y2="18" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><line x1="18" y1="33" x2="18" y2="27" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><line x1="3" y1="18" x2="9" y2="18" stroke="currentColor" stroke-width="0.8" opacity="0.5"/></svg>`,
};

// ─── Vendor Hub ───────────────────────────────────────────────────────────────

// Hoisted above the first renderVendorHub() call. `let` is in the temporal
// dead zone until its declaration line executes, so leaving this next to the
// function body (where it used to live) crashes the top-level call below with
// "Cannot access '_vendorObserver' before initialization". Function declarations
// hoist; `let` does not — keep this above any call site that touches it.
let _vendorObserver = null;

renderVendorHub();
updateBalanceUI();
updateMarketStrip();
updateRankStrip();
renderStipendStrip();
renderChaseStrip();
renderRecentHits();

// Live tick — refresh strip every 30s; check for cycle rollover, advance chase timer
setInterval(() => {
  if (timeUntilRefreshMs() === 0) {
    runRefresh();
    renderVendorHub();
    renderChaseStrip();
    showToast(`Market refreshed: ${getCurrentTrend().label}`, 'refresh');
  }
  updateMarketStrip();
  renderStipendStrip();
  renderChaseStrip();
}, 30 * 1000);

function updateMarketStrip() {
  const trend = getCurrentTrend();
  const lblT  = document.getElementById('market-trend-label');
  const lblR  = document.getElementById('market-refresh-label');
  if (lblT) lblT.textContent = trend.label;
  if (lblR) lblR.textContent = getRefreshLabel();
}

function updateRankStrip() {
  const rank   = getRank();
  const nameEl = document.getElementById('rank-name');
  const fill   = document.getElementById('rank-bar-fill');
  if (nameEl) nameEl.textContent = `${rank.name} · ${rank.current} pts`;
  if (fill)   fill.style.width   = rank.progressPct + '%';
}

// ─── Chase strip (Phase 9.6) ──────────────────────────────────────────────────

function renderChaseStrip() {
  const strip = document.getElementById('chase-strip');
  if (!strip) return;
  const chase = getDailyChase();
  if (!chase) { strip.classList.add('hidden'); return; }

  const remainMs = chase.expiry - Date.now();
  const hours    = Math.max(0, Math.floor(remainMs / 3_600_000));
  const mins     = Math.max(0, Math.floor((remainMs % 3_600_000) / 60_000));
  const timer    = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;

  strip.innerHTML = `
    <img class="chase-strip-img" src="${chase.imageUrl}" alt="${chase.name}" />
    <div class="chase-strip-text">
      <div class="chase-strip-label">Today's Chase Card</div>
      <div class="chase-strip-name">${chase.name}</div>
      <div class="chase-strip-boost">+${chase.boostPct}% market value boost</div>
    </div>
    <div class="chase-strip-timer">${timer}</div>
  `;
  strip.classList.remove('hidden');
  strip.onclick = () => {
    const cached  = getCachedSetCards(chase.setId) || [];
    const apiCard = cached.find(c => c.id === chase.cardId);
    if (apiCard) {
      const ownedEntry = getCollection()[chase.setId]?.[chase.cardId] ?? null;
      openCardDetail(apiCard, ownedEntry, chase.setId);
    }
  };
}

// ─── Stipend strip (Phase 9.9) ────────────────────────────────────────────────

function renderStipendStrip() {
  const strip = document.getElementById('stipend-strip');
  if (!strip) return;
  const amount = getStipendAmount();
  const ready  = canClaimStipend();
  const cdEl   = strip.querySelector('#stipend-cooldown');
  const btn    = strip.querySelector('#stipend-btn');
  const amtEl  = strip.querySelector('#stipend-amount');

  if (amtEl) amtEl.textContent = `$${amount}`;
  if (cdEl)  cdEl.textContent  = ready ? '' : `Next: ${stipendCountdown()}`;
  if (btn) {
    btn.disabled = !ready;
    btn.textContent = ready ? 'Claim' : 'Claimed';
    btn.onclick = () => {
      const got = claimStipend();
      if (got > 0) {
        updateBalanceUI();
        showToast(`Stipend claimed: +$${got}`, 'sell');
        renderStipendStrip();
      }
    };
  }
  strip.classList.remove('hidden');
}

// ─── Recent hits rail (Phase 9.9) ─────────────────────────────────────────────

function renderRecentHits() {
  const strip = document.getElementById('recent-hits-strip');
  const track = document.getElementById('recent-hits-track');
  if (!strip || !track) return;
  const hits = getRecentHits();
  if (hits.length === 0) { strip.classList.add('hidden'); return; }

  track.innerHTML = '';
  const SECRET_RARITIES = new Set(['hyperRare','specialIllustrationRare']);
  const ULTRA_RARITIES  = new Set(['ultraRare','illustrationRare','doubleRare']);
  hits.forEach(hit => {
    const tile = document.createElement('div');
    tile.className = 'recent-hit';
    if (SECRET_RARITIES.has(hit.rarity))      tile.classList.add('recent-hit--secret');
    else if (ULTRA_RARITIES.has(hit.rarity))  tile.classList.add('recent-hit--ultra');
    const rarityLabel = RARITY_LABELS[hit.rarity] || hit.rarity;
    tile.innerHTML = `
      <img src="${hit.imageUrl}" alt="${hit.name}" class="recent-hit-img" loading="lazy" />
      <div class="recent-hit-name">${hit.name}</div>
      <div class="recent-hit-rarity">${rarityLabel}</div>
    `;
    tile.onclick = () => {
      const cached  = getCachedSetCards(hit.setId) || [];
      const apiCard = cached.find(c => c.id === hit.cardId);
      if (apiCard) {
        const ownedEntry = getCollection()[hit.setId]?.[hit.cardId] ?? null;
        openCardDetail(apiCard, ownedEntry, hit.setId);
      }
    };
    track.appendChild(tile);
  });
  strip.classList.remove('hidden');
}

// _vendorObserver is declared above the first top-level renderVendorHub()
// call (search for "Hoisted above the first renderVendorHub() call").
function renderVendorHub() {
  const container = document.getElementById('vendor-list');
  container.innerHTML = '';

  // Render each vendor in isolation so a failure on one (e.g. corrupt
  // localStorage state, missing cached card data) cannot prevent the
  // rest of the hub from appearing.
  Object.values(VENDORS).forEach(vendor => {
    try {
      container.appendChild(renderVendorCard(vendor));
    } catch (err) {
      console.error(`[renderVendorHub] failed to render "${vendor.id}":`, err);
      const fallback = document.createElement('div');
      fallback.className = `vendor-card vendor-${vendor.theme} vendor-error`;
      fallback.setAttribute('data-vendor-id', vendor.id);
      fallback.innerHTML = `
        <div class="vendor-header">
          <div class="vendor-header-text">
            <div class="vendor-name">${vendor.name}</div>
            <div class="vendor-tagline">Temporarily unavailable.</div>
          </div>
        </div>`;
      container.appendChild(fallback);
    }
  });

  // IntersectionObserver on vendor cards switches ambient audio when
  // the user scrolls one into the dominant viewport position.
  if (_vendorObserver) _vendorObserver.disconnect();
  if ('IntersectionObserver' in window) {
    _vendorObserver = new IntersectionObserver((entries) => {
      // Pick the most-visible vendor that crossed threshold
      let best = null, bestRatio = 0.5;
      for (const e of entries) {
        if (e.intersectionRatio > bestRatio) {
          best = e.target;
          bestRatio = e.intersectionRatio;
        }
      }
      if (best) {
        const id = best.getAttribute('data-vendor-id');
        if (id) setVendorAmbient(id);
      }
    }, { threshold: [0.5, 0.75] });
    container.querySelectorAll('.vendor-card').forEach(el => _vendorObserver.observe(el));
  }
}

function renderVendorCard(vendor) {
  const open      = isVendorOpen(vendor.id);
  const stock     = getVendorStock(vendor.id);
  const favor     = getFavorProgress(vendor.id);

  const section = document.createElement('div');
  section.className = `vendor-card vendor-${vendor.theme} ${open ? '' : 'vendor-closed'}`;
  section.setAttribute('data-vendor-id', vendor.id);

  // Header
  const header = document.createElement('div');
  header.className = 'vendor-header';
  header.innerHTML = `
    <div class="vendor-header-text">
      <div class="vendor-name">${vendor.name}</div>
      <div class="vendor-tagline">${vendor.tagline}</div>
    </div>
    <div class="vendor-favor-pill">Lvl ${favor.level}</div>
  `;
  section.appendChild(header);

  // Body — different layouts per vendor
  const body = document.createElement('div');
  body.className = 'vendor-body';

  if (!open && vendor.id === 'broker') {
    body.innerHTML = `
      <div class="vendor-closed-msg">
        <div class="vendor-closed-icon">🔒</div>
        <div class="vendor-closed-title">${getBrokerNextOpenLabel() || 'Closed'}</div>
        <div class="vendor-closed-sub">The Broker only deals Friday through Sunday.</div>
      </div>
    `;
  } else if (vendor.id === 'broker') {
    // Broker inventory comes from chaseManager (weekly Friday rotation, persistent prices)
    const brokerInv = getBrokerInventory();
    const chaseGrid = document.createElement('div');
    chaseGrid.className = 'broker-chase-grid';
    if (brokerInv.length === 0) {
      chaseGrid.innerHTML = `<div class="vendor-empty">Curating inventory…</div>`;
    } else {
      brokerInv.forEach(pick => chaseGrid.appendChild(renderBrokerChaseTile(pick, vendor)));
    }
    body.appendChild(chaseGrid);
  } else {
    // Pack vendors
    const packGrid = document.createElement('div');
    packGrid.className = 'vendor-pack-grid';
    if (!stock.packs || stock.packs.length === 0) {
      packGrid.innerHTML = `<div class="vendor-empty">Stock loading…</div>`;
    } else {
      stock.packs.forEach(item => packGrid.appendChild(renderVendorPackTile(item, vendor)));
    }
    body.appendChild(packGrid);
  }

  // Mystery boxes — hidden entirely when the Broker is closed so the locked
  // state shows only the lock icon + timer, not inventory below it.
  // For all other vendors (or when broker is open) boxes render normally.
  if (open || vendor.id !== 'broker') try {
    const boxIds = getBoxesForVendor(vendor.id);
    if (boxIds.length > 0) {
      const boxGrid = document.createElement('div');
      boxGrid.className = 'vendor-pack-grid mystery-box-grid';
      boxIds.forEach(id => {
        try {
          const box = getBoxById(id);
          if (!box) { console.error('[vendorCard] getBoxById returned null for id:', id, 'vendor:', vendor.id); return; }
          boxGrid.appendChild(renderMysteryBoxTile(box, vendor));
        } catch (boxErr) {
          console.groupCollapsed(`[vendorCard] mystery box tile failed — id:${id} vendor:${vendor.id}`);
          console.error('Error:', boxErr);
          console.error('Stack:', boxErr?.stack);
          console.table({ boxId: id, vendorId: vendor.id, hasBox: !!getBoxById(id) });
          console.groupEnd();
        }
      });
      body.appendChild(boxGrid);
    }
  } catch (boxSectionErr) {
    console.error('[vendorCard] mystery box section failed for', vendor.id, boxSectionErr);
  }

  section.appendChild(body);

  // Footer — favor bar
  const footer = document.createElement('div');
  footer.className = 'vendor-footer';
  footer.innerHTML = `
    <div class="vendor-favor-bar">
      <div class="vendor-favor-fill" style="width:${favor.progressPct}%"></div>
    </div>
    <div class="vendor-favor-text">
      ${favor.nextThreshold
        ? `${favor.current} / ${favor.nextThreshold} favor`
        : `Max favor — ${favor.current} pts`}
    </div>
  `;
  section.appendChild(footer);

  return section;
}

function renderVendorPackTile(item, vendor) {
  const pack    = PACK_STORE[item.setId];
  if (!pack) return document.createElement('div');
  const finalPrice = getEffectivePackPrice(vendor.id, item.price);
  const tile = document.createElement('div');
  tile.className = 'vendor-pack-tile';
  const artUrl = `${import.meta.env.BASE_URL}${pack.art}`;

  tile.innerHTML = `
    <img src="${artUrl}" class="vendor-pack-art" alt="${pack.name}" />
    <div class="vendor-pack-name">${pack.name}</div>
    ${item.discount ? `<div class="vendor-discount-badge">-${item.discount}%</div>` : ''}
    <div class="vendor-pack-price">$${finalPrice.toFixed(2)}</div>
    <button class="vendor-buy-btn">Buy Pack</button>
  `;

  const btn = tile.querySelector('.vendor-buy-btn');
  btn.onclick = () => buyPackFromVendor(item.setId, finalPrice, vendor, btn);
  return tile;
}

function renderBrokerChaseTile(pick, vendor) {
  const tile = document.createElement('div');
  tile.className = 'broker-chase-tile';

  // Look up the live apiCard for click-through detail
  const cached  = getCachedSetCards(pick.setId) || [];
  const apiCard = cached.find(c => c.id === pick.cardId);

  tile.innerHTML = `
    <img src="${pick.imageUrl}" class="broker-chase-img" alt="${pick.name}" />
    <div class="broker-chase-name">${pick.name}</div>
    <div class="broker-chase-tier">${RARITY_LABELS[pick.tier] || pick.tier}</div>
    <div class="broker-chase-price">$${pick.price.toLocaleString()}</div>
    <button class="vendor-buy-btn vendor-buy-btn--lux">Acquire</button>
  `;

  const btn = tile.querySelector('button');
  btn.onclick = (e) => {
    e.stopPropagation();
    buyChaseCard(apiCard || { id: pick.cardId, name: pick.name, images: { small: pick.imageUrl } },
                 pick.setId, pick.price, vendor, btn);
  };
  return tile;
}

// ─── Mystery box tile + opening ─────────────────────────────────────────────
// BOX_EMBLEMS is declared above renderVendorHub() — see the note there.

function renderMysteryBoxTile(box, vendor) {
  if (!box) {
    console.error('[renderMysteryBoxTile] box is null for vendor', vendor?.id);
    return document.createElement('div');
  }
  const tile = document.createElement('div');
  tile.className = `mystery-box-tile mystery-box-tile--${vendor.id}`;
  const emblem = BOX_EMBLEMS[vendor.id] || BOX_EMBLEMS.retroVault || '';

  // Build innerHTML from a single-line string — no embedded HTML comments,
  // no multi-line whitespace — to guarantee every browser's parser produces
  // the same subtree and querySelector('.mystery-box-cta') never returns null.
  tile.innerHTML =
    `<div class="mystery-box-art"><div class="mystery-box-emblem">${emblem}</div></div>` +
    `<div class="mystery-box-name">${box.name}</div>` +
    `<div class="mystery-box-meta">${box.packCount} sealed packs</div>` +
    `<div class="mystery-box-price">$${box.price.toFixed(2)}</div>` +
    `<button class="mystery-box-cta">Acquire</button>`;

  const btn = tile.querySelector('.mystery-box-cta');
  if (!btn) {
    console.error('[renderMysteryBoxTile] button not found after innerHTML set — vendor:', vendor.id, 'box:', box.id);
    return tile;
  }
  btn.onclick = (e) => {
    e.stopPropagation();
    purchaseMysteryBox(box, vendor, btn);
  };
  return tile;
}

async function purchaseMysteryBox(box, vendor, btn) {
  if (!spendBalance(box.price)) {
    btn.textContent = 'Insufficient';
    setTimeout(() => { btn.textContent = 'Acquire'; }, 1800);
    return;
  }
  updateBalanceUI();
  haptic('medium');
  sfx.purchase();
  btn.disabled = true;
  btn.textContent = 'Opening…';

  // Roll contents and reveal — the modal resolves once the user either
  // confirms the reveal or dismisses it. Either way the box was paid
  // for, so we always proceed to open the contained packs.
  const setIds = rollBoxContents(box.id);
  await showMysteryBoxReveal(box, setIds);

  // Sequentially open each pack via the existing flow (skip spend)
  for (const setId of setIds) {
    await runPackOpening(setId, vendor, { skipSpend: true, favorBasis: box.price / setIds.length });
  }

  // Vendor favor bonus for the box itself (small additional)
  addFavor(vendor.id, Math.max(2, Math.floor(box.price / 12)));
  showToast(`${vendor.name} Favor +${Math.max(2, Math.floor(box.price / 12))}`, 'favor');

  renderVendorHub();
  updateRankStrip();
}

// ─── Pack purchase ────────────────────────────────────────────────────────────

async function buyPackFromVendor(setId, price, vendor, btn) {
  // Pre-check (so we can show "Insufficient Funds" without engaging the
  // full pack-opening flow that the helper below would otherwise start).
  if (!isInfiniteBalance() && getBalance() < price) {
    btn.textContent = 'Insufficient Funds';
    setTimeout(() => { btn.textContent = 'Buy Pack'; }, 2000);
    return;
  }
  btn.disabled = true;
  try {
    await runPackOpening(setId, vendor, { skipSpend: false, favorBasis: price, price });
  } finally {
    btn.disabled = false;
  }
}

/**
 * Core pack opening flow shared by direct purchases and mystery boxes.
 * Handles balance debit, animation, card grant, favor, reputation,
 * recent hits, and set-completion bonus.
 */
async function runPackOpening(setId, vendor, { skipSpend, favorBasis, price }) {
  if (!skipSpend) {
    if (!spendBalance(price)) return;          // race-safety
    sfx.purchase();
  }
  updateBalanceUI();

  const animationDone = openPackInteraction(setId);
  let dataReady = false;
  const loadDone = (async () => {
    if (getCurrentSetId() !== setId) await loadSet(setId);
    setCurrentSet(setId); dataReady = true; hidePackLoadingIndicator();
  })();
  await animationDone;
  if (!dataReady) { showPackLoadingIndicator(); await loadDone; }

  engine.stepSimulation();
  const newCards = augmentCards(engine.state.cards.slice(-10), setId);
  await openPackOverlay(newCards, engine.state.packsOpened);

  const newDiscoveries = newCards.filter(c => !getOwnedEntry(setId, c.id)).length;
  newCards.forEach(addCard);
  newCards.forEach(addCardToCollection);
  incrementPacksOpened();

  const hadRarePull = newCards.some(c =>
    RARITY_ORDER.indexOf(c.rarityType || c.rarity) >= 3);
  if (hadRarePull) { haptic('heavy'); sfx.rareShimmer(); }

  // Record notable pulls for the recent-hits rail
  newCards.forEach(c => {
    if (RARITY_ORDER.indexOf(c.rarityType || c.rarity) >= 2) {
      recordHit({
        cardId:  c.id, setId,
        rarity:  c.rarityType || c.rarity,
        name:    c.name,
        imageUrl:c.imageUrl,
      });
    }
  });
  renderRecentHits();

  // Vendor favor — based on the favor basis the caller provided
  const favorEarned = Math.max(1, Math.floor((favorBasis || 0) / 5));
  addFavor(vendor.id, favorEarned);
  if (!skipSpend) showToast(`${vendor.name} Favor +${favorEarned}`, 'favor');

  // Reputation
  let repGain = 1 + newDiscoveries * 5;
  repGain += newCards.filter(c => RARITY_ORDER.indexOf(c.rarity) >= 2).length * 2;
  addReputation(repGain);
  if (repGain >= 10 && !isSandboxMode()) showToast(`Reputation +${repGain}`, 'rep');

  // Set-completion bonus
  const cachedSet  = getCachedSetCards(setId) || [];
  const ownedNow   = getCollection()[setId] || {};
  if (cachedSet.length > 0 && Object.keys(ownedNow).length === cachedSet.length) {
    addReputation(250);
    if (!isSandboxMode()) showToast(`Set complete! Reputation +250`, 'rep');
    haptic('heavy');
    sfx.rareShimmer();
  }

  if (!skipSpend) {
    renderVendorHub();
    updateRankStrip();
  }
}

async function buyChaseCard(apiCard, setId, price, vendor, btn) {
  if (!spendBalance(price)) {
    btn.textContent = 'Insufficient Funds';
    setTimeout(() => { btn.textContent = 'Acquire'; }, 2000);
    return;
  }
  updateBalanceUI();
  btn.disabled = true;
  btn.textContent = 'Acquired ✓';

  // Add directly to collection
  addCardToCollection({ setId, id: apiCard.id });
  removeBrokerPick(apiCard.id);
  addFavor(vendor.id, Math.floor(price / 50));
  addReputation(20);

  // Record as a hit so it appears in the recent-hits rail
  const tier = apiCard.rarity ? mapPokemonRarity(apiCard.rarity) : 'specialIllustrationRare';
  recordHit({
    cardId: apiCard.id, setId, rarity: tier,
    name: apiCard.name,
    imageUrl: apiCard.images?.small || apiCard.images?.large,
  });

  showToast(`Acquired ${apiCard.name}`, 'rep');
  updateRankStrip();
  renderRecentHits();
  setTimeout(() => renderVendorHub(), 600);
}

function updateBalanceUI() {
  const el = document.getElementById('balance-display');
  if (el) el.textContent = '$' + getBalance().toFixed(2);
}

// ─── Phase 10.1.7 — iOS touch-bypass utility ─────��───────────────────────────
//
// On iOS Safari, click events sometimes fail to fire even when :active fires.
// The browser's gesture recogniser can classify a touch as a potential scroll
// before it ever synthesises a click, especially when the document is taller
// than the viewport (normal for the vendor hub) or when the button is inside
// a -webkit-overflow-scrolling:touch container (overlay screens).
//
// iosTap() adds:
//   • passive touchstart — records start position
//   • passive touchmove  — sets a "moved" flag if finger travels > 8 px
//   • NON-passive touchend — if NOT moved, calls handler() directly and calls
//     e.preventDefault() to suppress the subsequent synthetic click so the
//     handler does NOT fire twice on iOS.
//
// The existing .onclick / addEventListener('click') assignment is kept as-is
// so desktop mouse-clicks continue to work normally (touchend never fires on
// a mouse, so there is no double-call risk).
//
// DO NOT make this listener passive — preventDefault() on a passive listener
// is a no-op and the synthetic click suppression would not work.
function iosTap(el, handler) {
  if (!el) return;
  // Phase 10.1.8: when ?noiostap=1 is set, the entire bypass becomes a no-op.
  // Buttons fall back to their .onclick assignment only — pure native click.
  // This proves / disproves whether iosTap's preventDefault on touchend is
  // itself somehow suppressing downstream click delivery on the page.
  if (DEBUG_FLAGS.noIosTap) {
    return;
  }
  let startX = 0, startY = 0, moved = false;
  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved  = false;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (dx * dx + dy * dy > 64) moved = true; // 8 px radius
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!moved) {
      e.preventDefault(); // suppress synthetic click → no double-fire
      handler();
    }
  }, { passive: false });
}

// ─── Collection screen ────────────────────────────────────────────────────────

document.getElementById('view-collection-btn').onclick = openCollectionScreen;
iosTap(document.getElementById('view-collection-btn'), openCollectionScreen);
document.getElementById('collection-back-btn').onclick  = closeCollectionScreen;
iosTap(document.getElementById('collection-back-btn'), closeCollectionScreen);
document.getElementById('wishlist-btn').onclick         = openWishlistScreen;
iosTap(document.getElementById('wishlist-btn'), openWishlistScreen);

// Phase 10.3: TouchTrace gated by touchTrace sub-flag.
if (isDebugMode() && isDiagFlag('touchTrace')) {
  const _btn = document.getElementById('view-collection-btn');
  if (_btn) {
    const _mark = (name) => (e) => console.log(
      `[TouchTrace] ${name}`,
      'target:', e.target?.id || e.target?.tagName,
      '| defaultPrevented:', e.defaultPrevented,
      '| cancelable:', e.cancelable,
      '| ts:', performance.now().toFixed(1),
    );
    _btn.addEventListener('touchstart',  _mark('touchstart'),  { passive: true });
    _btn.addEventListener('touchend',    _mark('touchend'),    { passive: true });
    _btn.addEventListener('pointerdown', _mark('pointerdown'));
    _btn.addEventListener('pointerup',   _mark('pointerup'));
    _btn.addEventListener('click',       _mark('click'));
    console.log('[NavBinding] #view-collection-btn — onclick:', typeof _btn.onclick, '| iosTap: attached');
  }
}

function openCollectionScreen() {
  const el = document.getElementById('collection-screen');
  if (!el) { console.error('[Nav] openCollectionScreen() aborted — collection-screen missing from DOM'); return; }
  try {
    lockBodyScroll();
    renderCollectionScreen();
  } catch (err) {
    console.error('[Nav] openCollectionScreen() — renderCollectionScreen threw:', err);
  }
  showScreen(el);
}
function closeCollectionScreen() {
  hideScreen(document.getElementById('collection-screen'));
  unlockBodyScroll();
}

function renderCollectionScreen() {
  const collection = getCollection();
  const container  = document.getElementById('set-list');
  container.innerHTML = '';

  const setIds = Object.keys(collection);
  if (setIds.length === 0) {
    container.innerHTML = '<p class="collection-empty">No cards yet — buy a pack!</p>';
    return;
  }

  setIds.forEach((setId) => {
    const packInfo   = PACK_STORE[setId];
    const owned      = collection[setId];
    const ownedCount = Object.keys(owned).length;
    const cached     = getCachedSetCards(setId);
    // Use live API count when available; fall back to static packStore metadata
    // so "?" never appears for sets that haven't been opened in this session.
    const total      = cached ? cached.length : (packInfo?.totalCards ?? '--');
    const pct        = cached && cached.length > 0
      ? Math.min(100, (ownedCount / cached.length) * 100).toFixed(1)
      : packInfo?.totalCards
        ? Math.min(100, (ownedCount / packInfo.totalCards) * 100).toFixed(1)
        : 0;

    let secretOwned = 0, secretTotal = 0;
    if (cached) cached.forEach(c => {
      if (SECRET_TIERS.has(mapPokemonRarity(c.rarity))) {
        secretTotal++;
        if (owned[c.id]) secretOwned++;
      }
    });

    const card = document.createElement('div');
    card.className = 'set-card';
    const artUrl = packInfo ? `${import.meta.env.BASE_URL}${packInfo.art}` : '';
    card.innerHTML = `
      ${artUrl ? `<img src="${artUrl}" class="set-card-art" alt="${packInfo.name}" />` : ''}
      <div class="set-card-info">
        <div class="set-card-name">${packInfo?.name || setId}</div>
        <div class="set-card-progress">${ownedCount} / ${total} · ${pct}%</div>
        <div class="set-card-progress-bar">
          <div class="set-card-progress-fill" style="width:${pct}%"></div>
        </div>
        ${secretTotal > 0 ? `<div class="set-card-secrets">Secret Rares: ${secretOwned} / ${secretTotal}</div>` : ''}
      </div>
    `;
    if (cached && ownedCount >= cached.length && cached.length > 0) card.classList.add('set-complete');
    card.onclick = () => openBinderScreen(setId);
    container.appendChild(card);
  });
}

// ─── Binder screen ────────────────────────────────────────────────────────────

document.getElementById('binder-back-btn').onclick = closeBinderScreen;
iosTap(document.getElementById('binder-back-btn'), closeBinderScreen);

// Phase 10.3: BinderBack trace gated by touchTrace sub-flag.
if (isDebugMode() && isDiagFlag('touchTrace')) {
  const _bb = document.getElementById('binder-back-btn');
  if (_bb) {
    ['touchstart','touchend','pointerdown','pointerup','click'].forEach(t => {
      _bb.addEventListener(t, (e) => console.log(
        `[BinderBack:${t}]`,
        '| target:', e.target?.id || e.target?.tagName,
        '| defaultPrevented:', e.defaultPrevented,
      ), { passive: true });
    });
    console.log('[NavBinding] #binder-back-btn touch trace attached');
  }
}
document.getElementById('binder-prev').onclick      = () => navigateBinderPage(-1);
iosTap(document.getElementById('binder-prev'), () => navigateBinderPage(-1));
document.getElementById('binder-next').onclick      = () => navigateBinderPage(1);
iosTap(document.getElementById('binder-next'), () => navigateBinderPage(1));

async function navigateBinderPage(dir) {
  haptic('medium');
  const grid = document.querySelector('#binder-pages .binder-page');
  if (grid) {
    grid.classList.add(dir === 1 ? 'flip-left' : 'flip-right');
    await new Promise(r => setTimeout(r, 280));
  }
  _binderPage += dir;
  renderBinderPage();
}

async function openBinderScreen(setId, highlightCardId) {
  _binderSetId = setId;
  _binderPage  = _binderPageMemory[setId] ?? 0;
  if (highlightCardId) {
    const cached = getCachedSetCards(setId) || [];
    const idx    = cached.findIndex(c => c.id === highlightCardId);
    if (idx !== -1) _binderPage = Math.floor(idx / CARDS_PER_PAGE);
    _pendingHighlightId = highlightCardId;
  }

  const packInfo = PACK_STORE[setId];
  document.getElementById('binder-set-name').textContent = packInfo?.name || setId;

  hideScreen(document.getElementById('collection-screen'));
  hideScreen(document.getElementById('stats-screen'));
  showScreen(document.getElementById('binder-screen'));
  lockBodyScroll();

  if (!getCachedSetCards(setId)) {
    document.getElementById('binder-pages').innerHTML = '<p class="binder-loading">Loading cards...</p>';
    await loadSet(setId);
  }
  renderBinderPage();
}

function closeBinderScreen() {
  unlockBodyScroll();
  hideScreen(document.getElementById('binder-screen'));
  showScreen(document.getElementById('collection-screen'));
}

function renderBinderPage() {
  const allCards   = getCachedSetCards(_binderSetId) || [];
  const collection = getCollection();
  const owned      = collection[_binderSetId] || {};
  const ownedCount = Object.keys(owned).length;
  const totalCount = allCards.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CARDS_PER_PAGE));

  _binderPage = Math.max(0, Math.min(_binderPage, totalPages - 1));
  _binderPageMemory[_binderSetId] = _binderPage;

  document.getElementById('binder-progress').textContent = `${ownedCount} / ${totalCount}`;
  document.getElementById('binder-page-label').textContent = `Page ${_binderPage + 1} / ${totalPages}`;
  document.getElementById('binder-prev').disabled = _binderPage === 0;
  document.getElementById('binder-next').disabled = _binderPage >= totalPages - 1;

  const pageCards = allCards.slice(_binderPage * CARDS_PER_PAGE, (_binderPage + 1) * CARDS_PER_PAGE);
  const container = document.getElementById('binder-pages');
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'binder-page';

  pageCards.forEach((apiCard, localIdx) => {
    const globalIdx  = _binderPage * CARDS_PER_PAGE + localIdx + 1;
    const ownedEntry = owned[apiCard.id] ?? null;
    const wishlisted = isWishlisted(apiCard.id);
    const rarityTier = mapPokemonRarity(apiCard.rarity) || 'common';

    // Enrich market meta lazily so trend system can bias by type/set
    if (ownedEntry) {
      getMarketValue(apiCard.id, rarityTier);
      enrichMarketMeta(apiCard.id, { types: apiCard.types, setId: _binderSetId });
    }

    const slot = document.createElement('div');
    slot.className = 'binder-slot';
    slot.dataset.cardId = apiCard.id;

    if (ownedEntry) {
      slot.classList.add(`rarity-${rarityTier}`);
      const img = document.createElement('img');
      img.src = apiCard.images.small || apiCard.images.large;
      img.alt = apiCard.name;
      img.loading = 'lazy';
      img.className = 'binder-slot-img';
      slot.appendChild(img);

      if (ownedEntry.count > 1) {
        const badge = document.createElement('div');
        badge.className   = 'duplicate-badge';
        badge.textContent = '×' + ownedEntry.count;
        slot.appendChild(badge);
      }

      // Lock icon for first/last copies that are still locked
      if (ownedEntry.count === 1 && (ownedEntry.locked !== false)) {
        const lock = document.createElement('div');
        lock.className   = 'lock-corner';
        lock.textContent = '🔒';
        slot.appendChild(lock);
      }

      slot.onclick = () => openCardDetail(apiCard, ownedEntry, _binderSetId);
    } else {
      slot.classList.add('unowned', `unowned-${rarityTier}`);
      const img = document.createElement('img');
      img.src = apiCard.images.small || apiCard.images.large;
      img.alt = '';
      img.loading = 'lazy';
      img.className = 'binder-slot-img binder-slot-img--unowned';
      slot.appendChild(img);

      const overlay = document.createElement('div');
      overlay.className = 'unowned-overlay';
      overlay.innerHTML = `<div class="empty-slot-number">#${String(globalIdx).padStart(3,'0')}</div>`;
      slot.appendChild(overlay);

      slot.onclick = () => openCardDetail(apiCard, null, _binderSetId);
    }

    if (wishlisted) {
      const star = document.createElement('div');
      star.className   = 'wishlist-corner';
      star.textContent = '★';
      slot.appendChild(star);
    }
    grid.appendChild(slot);
  });

  container.appendChild(grid);

  if (_pendingHighlightId) {
    const id = _pendingHighlightId;
    _pendingHighlightId = null;
    setTimeout(() => {
      const target = grid.querySelector(`[data-card-id="${id}"]`);
      if (target) {
        target.classList.add('slot-highlight');
        setTimeout(() => target.classList.remove('slot-highlight'), 1400);
      }
    }, 60);
  }
}

// ─── Evolution chain ──────────────────────────────────────────────────────────

function buildEvolutionChain(apiCard, setId) {
  const setCards = getCachedSetCards(setId) || [];
  const pokémon  = setCards.filter(c => c.supertype === 'Pokémon');
  const byName   = (n) => pokémon.find(c => c.name === n);
  const chain    = [];
  const visited  = new Set();

  let cursor = apiCard;
  while (cursor?.evolvesFrom && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const prev = byName(cursor.evolvesFrom);
    if (!prev) break;
    chain.unshift(prev);
    cursor = prev;
  }
  chain.push(apiCard);

  cursor = apiCard;
  visited.clear();
  while (cursor?.evolvesTo?.length > 0 && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const next = byName(cursor.evolvesTo[0]);
    if (!next || next.id === apiCard.id) break;
    chain.push(next);
    cursor = next;
  }
  return chain.length > 1 ? chain : null;
}

// ─── Card detail / preview modal ──────────────────────────────────────────────

function openCardDetail(apiCard, ownedEntry, setId) {
  const modal      = document.getElementById('card-detail-modal');
  // Phase 10.1.8: ?nooverlays=1 removes this node from the DOM at boot.
  // Without this guard, every card tap would crash with TypeError.
  if (!modal) {
    console.warn('[Modal] #card-detail-modal not in DOM — open SKIPPED (nooverlays flag?)');
    return;
  }
  const isOwned    = ownedEntry !== null;
  const rarityTier = mapPokemonRarity(apiCard.rarity) || 'common';
  const value      = getMarketValue(apiCard.id, rarityTier);
  const pullRate   = PULL_RATES[rarityTier]    || '~1 in 1 pack';
  const rarityLbl  = RARITY_LABELS[rarityTier] || apiCard.rarity;
  const wishlisted = isWishlisted(apiCard.id);

  const setName = apiCard.set?.name  || '';
  const cardNum = apiCard.number     ? `#${apiCard.number}` : '';
  const setLine = [setName, cardNum].filter(Boolean).join(' · ');
  const hp      = apiCard.hp         ? `${apiCard.hp} HP` : '';
  const types   = apiCard.types?.join(' / ')  || '';
  const artist  = apiCard.artist     || '';
  const flavor  = apiCard.flavorText || '';
  const stage   = apiCard.subtypes?.join(', ') || '';

  const imgClass = isOwned ? 'cdp-image' : 'cdp-image cdp-image--preview';
  const imgSrc   = apiCard.images.large || apiCard.images.small;

  const resolvedSetId = setId || apiCard.set?.id;
  const chain         = resolvedSetId ? buildEvolutionChain(apiCard, resolvedSetId) : null;
  let chainHTML = '';
  if (chain) {
    const items = chain.map(c => {
      const isCurrent = c.id === apiCard.id;
      return `<div class="${isCurrent ? 'evo-node evo-node--current' : 'evo-node'}" data-evo-id="${c.id}">${c.name}</div>`;
    }).join('<div class="evo-arrow">→</div>');
    chainHTML = `<div class="evo-chain">${items}</div>`;
  }

  const ownedLine     = isOwned ? `<div class="cdp-owned">Owned: ×${ownedEntry.count} ${(ownedEntry.locked !== false && ownedEntry.count === 1) ? '🔒' : ''}</div>` : '';
  const previewNotice = !isOwned ? `<div class="cdp-not-owned">Not in your collection yet</div>` : '';
  const viewInBinderBtn = (isOwned && resolvedSetId)
    ? `<button class="cdp-view-binder-btn" id="cdp-view-binder">📖 View In Binder</button>` : '';
  const sellBtn = (isOwned && resolvedSetId)
    ? `<button class="cdp-sell-btn" id="cdp-sell">💰 Sell to Vendor</button>` : '';

  modal.innerHTML = `
    <div class="card-detail-content" id="cdp-panel">
      <div class="cdp-image-wrap">
        <img src="${imgSrc}" alt="${apiCard.name}" class="${imgClass}" />
        ${!isOwned ? `<div class="cdp-preview-badge">${rarityLbl}</div>` : ''}
      </div>
      <div class="card-detail-info">
        <div class="cdp-name">${apiCard.name}</div>
        <div class="cdp-rarity cdp-rarity-${rarityTier}">${rarityLbl}</div>
        ${setLine  ? `<div class="cdp-set">${setLine}</div>` : ''}
        ${chainHTML}
        <div class="cdp-divider"></div>
        <div class="cdp-row"><span>Est. Value</span><span class="cdp-value">$${value.toFixed(2)}</span></div>
        <div class="cdp-row"><span>Pull Rate</span><span>${pullRate}</span></div>
        ${types  ? `<div class="cdp-row"><span>Type</span><span>${types}</span></div>`  : ''}
        ${hp     ? `<div class="cdp-row"><span>HP</span><span>${hp}</span></div>`       : ''}
        ${stage  ? `<div class="cdp-row"><span>Stage</span><span>${stage}</span></div>` : ''}
        ${artist ? `<div class="cdp-row"><span>Artist</span><span>${artist}</span></div>` : ''}
        ${ownedLine}
        ${previewNotice}
        ${flavor ? `<div class="cdp-flavor">${flavor}</div>` : ''}
        <button class="cdp-wishlist-btn ${wishlisted ? 'active' : ''}" id="cdp-wishlist-btn">
          ${wishlisted ? '★ On Wishlist' : '☆ Add to Wishlist'}
        </button>
        ${viewInBinderBtn}
        ${sellBtn}
      </div>
    </div>
  `;

  modal.querySelector('#cdp-panel').onclick = e => e.stopPropagation();

  modal.querySelector('#cdp-wishlist-btn').onclick = e => {
    e.stopPropagation();
    haptic('soft');
    const btn = modal.querySelector('#cdp-wishlist-btn');
    const nowListed = toggleWishlist(apiCard.id);
    btn.classList.toggle('active', nowListed);
    btn.textContent = nowListed ? '★ On Wishlist' : '☆ Add to Wishlist';
    if (_binderSetId) renderBinderPage();
  };

  modal.querySelectorAll('.evo-node:not(.evo-node--current)').forEach(node => {
    node.style.cursor = 'pointer';
    node.onclick = e => {
      e.stopPropagation();
      const tid = node.dataset.evoId;
      const setCards = getCachedSetCards(resolvedSetId) || [];
      const target = setCards.find(c => c.id === tid);
      if (!target) return;
      const ownedEvo = getCollection()[resolvedSetId]?.[tid] ?? null;
      hideScreen(modal);
      setTimeout(() => openCardDetail(target, ownedEvo, resolvedSetId), 60);
    };
  });

  const viewBtn = modal.querySelector('#cdp-view-binder');
  if (viewBtn) {
    viewBtn.onclick = e => {
      e.stopPropagation();
      hideScreen(modal);
      setTimeout(() => {
        if (_binderSetId === resolvedSetId) {
          const all = getCachedSetCards(resolvedSetId) || [];
          const idx = all.findIndex(c => c.id === apiCard.id);
          if (idx !== -1) {
            _binderPage = Math.floor(idx / CARDS_PER_PAGE);
            _pendingHighlightId = apiCard.id;
            renderBinderPage();
          }
        } else {
          openBinderScreen(resolvedSetId, apiCard.id);
        }
      }, 260);
    };
  }

  const sellBtnEl = modal.querySelector('#cdp-sell');
  if (sellBtnEl) {
    sellBtnEl.onclick = e => {
      e.stopPropagation();
      hideScreen(modal);
      setTimeout(() => openSellModal(apiCard, ownedEntry, resolvedSetId), 260);
    };
  }

  showScreen(modal);
  lockBodyScroll();
  modal.onclick = () => { hideScreen(modal); unlockBodyScroll(); };
}

// ─── Sell modal ───────────────────────────────────────────────────────────────

function openSellModal(apiCard, ownedEntry, setId) {
  const modal      = document.getElementById('sell-modal');
  // Phase 10.1.8: ?nooverlays=1 removes this node from the DOM at boot.
  if (!modal) {
    console.warn('[Modal] #sell-modal not in DOM — open SKIPPED (nooverlays flag?)');
    return;
  }
  const rarityTier = mapPokemonRarity(apiCard.rarity) || 'common';
  const isLastCopy = ownedEntry.count === 1;
  const gated      = isSellGated(setId, apiCard.id, ownedEntry.count);

  // Build vendor cards (skip Broker — Broker buys nothing)
  const vendorRows = ['pokemart','retroVault','nightMarket'].map(vid => {
    const v   = VENDORS[vid];
    const br  = calculateSellPayout(apiCard.id, rarityTier, vid);
    const open = isVendorOpen(vid);
    return `
      <div class="sell-vendor-row" data-vendor="${vid}" ${open ? '' : 'data-disabled="1"'}>
        <div class="sell-vendor-info">
          <div class="sell-vendor-name">${v.name}</div>
          <div class="sell-vendor-meta">Commission ${(br.commissionPct * 100).toFixed(0)}% · +${br.favorReward} favor</div>
        </div>
        <div class="sell-vendor-payout">$${br.payout.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="sell-modal-content" id="sell-panel">
      <div class="sell-header">
        <img src="${apiCard.images.small || apiCard.images.large}" alt="${apiCard.name}" class="sell-card-img" />
        <div class="sell-card-info">
          <div class="sell-card-name">${apiCard.name}</div>
          <div class="sell-card-rarity">${RARITY_LABELS[rarityTier]}</div>
          <div class="sell-card-owned">Owned: ×${ownedEntry.count}</div>
        </div>
      </div>
      ${gated ? `
        <div class="sell-warning">
          <div class="sell-warning-icon">⚠️</div>
          <div class="sell-warning-text">
            <div class="sell-warning-title">Last copy locked</div>
            <div>You're about to sell your only copy of this card.</div>
          </div>
        </div>` : ''}
      <div class="sell-vendor-list">${vendorRows}</div>
      <div class="sell-actions">
        <button class="sell-cancel-btn" id="sell-cancel">Cancel</button>
        ${gated
          ? `<button class="sell-confirm-btn sell-confirm-btn--warn" id="sell-unlock-confirm" disabled>Unlock & Sell</button>`
          : `<button class="sell-confirm-btn" id="sell-confirm" disabled>Sell</button>`}
      </div>
    </div>
  `;

  modal.querySelector('#sell-panel').onclick = e => e.stopPropagation();

  // Vendor row selection
  let selectedVendor = null;
  modal.querySelectorAll('.sell-vendor-row').forEach(row => {
    if (row.dataset.disabled) return;
    row.onclick = () => {
      modal.querySelectorAll('.sell-vendor-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      selectedVendor = row.dataset.vendor;
      const confirmBtn = modal.querySelector('#sell-confirm') || modal.querySelector('#sell-unlock-confirm');
      if (confirmBtn) confirmBtn.disabled = false;
    };
  });

  // Cancel
  modal.querySelector('#sell-cancel').onclick = () => { hideScreen(modal); unlockBodyScroll(); };

  // Confirm
  const confirmBtn = modal.querySelector('#sell-confirm') || modal.querySelector('#sell-unlock-confirm');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (!selectedVendor) return;
      haptic('medium');
      if (gated) unlockCard(setId, apiCard.id);
      const result = sellCard(setId, apiCard.id, rarityTier, selectedVendor, { force: true });
      updateBalanceUI();
      const vName = VENDORS[selectedVendor].name;
      showToast(`Sold for $${result.payout.toFixed(2)} · ${vName} Favor +${result.favorReward}`, 'sell');
      hideScreen(modal);
      unlockBodyScroll();
      // Refresh whatever's behind
      if (_binderSetId) renderBinderPage();
      renderVendorHub();
    };
  }

  showScreen(modal);
  modal.onclick = (e) => { if (e.target === modal) { hideScreen(modal); unlockBodyScroll(); } };
}

// ─── Stats screen ─────────────────────────────────────────────────────────────

document.getElementById('stats-btn').onclick      = openStatsScreen;
iosTap(document.getElementById('stats-btn'), openStatsScreen);
document.getElementById('stats-back-btn').onclick = closeStatsScreen;
iosTap(document.getElementById('stats-back-btn'), closeStatsScreen);

document.getElementById('market-btn')?.addEventListener('click', () => {
  lockBodyScroll();
  openMarketScreen();
});
iosTap(document.getElementById('market-btn'), () => {
  lockBodyScroll();
  openMarketScreen();
});
document.addEventListener('market-screen-closed', () => unlockBodyScroll());

function openStatsScreen() {
  const el = document.getElementById('stats-screen');
  if (!el) { console.error('[Nav] openStatsScreen() aborted — stats-screen missing from DOM'); return; }
  try {
    lockBodyScroll();
    renderStatsScreen();
  } catch (err) {
    console.error('[Nav] openStatsScreen() — renderStatsScreen threw:', err);
  }
  showScreen(el);
}
function closeStatsScreen() {
  hideScreen(document.getElementById('stats-screen'));
  unlockBodyScroll();
}

function renderStatsScreen() {
  const collection  = getCollection();
  const allValues   = getAllMarketValues();
  const packsOpened = getPacksOpened();
  const rank        = getRank();

  let totalCards = 0, totalDupes = 0, totalValue = 0, secretRares = 0, wishlistHits = 0;
  let mostValCard = null, mostValAmount = 0;
  let rarestCard  = null, rarestIdx = -1;
  const setCardCounts = {};

  for (const [setId, cards] of Object.entries(collection)) {
    const cached = getCachedSetCards(setId) || [];
    const byId   = Object.fromEntries(cached.map(c => [c.id, c]));
    setCardCounts[setId] = Object.keys(cards).length;
    for (const [cardId, entry] of Object.entries(cards)) {
      totalCards++;
      totalDupes += Math.max(0, entry.count - 1);
      const apiCard = byId[cardId];
      const tier    = apiCard ? mapPokemonRarity(apiCard.rarity) : 'common';
      const val     = allValues[cardId] ?? getMarketValue(cardId, tier);
      totalValue   += val;
      if (val > mostValAmount)    { mostValAmount = val; mostValCard = apiCard; }
      const ti = RARITY_ORDER.indexOf(tier);
      if (ti > rarestIdx)         { rarestIdx = ti; rarestCard = apiCard; }
      if (SECRET_TIERS.has(tier)) secretRares++;
      if (isWishlisted(cardId))   wishlistHits++;
    }
  }

  const setIds = Object.keys(collection);
  const avgCompletion = setIds.length === 0 ? 0
    : setIds.map(sid => {
        const cached = getCachedSetCards(sid);
        if (!cached || !cached.length) return 0;
        return Math.min(100, Object.keys(collection[sid]).length / cached.length * 100);
      }).reduce((a, b) => a + b, 0) / setIds.length;

  const favEntry   = Object.entries(setCardCounts).sort((a, b) => b[1] - a[1])[0];
  const favSetName = favEntry ? (PACK_STORE[favEntry[0]]?.name || favEntry[0]) : '—';

  // Vendor favor summary
  const favorRows = Object.values(VENDORS).map(v => {
    const fp = getFavorProgress(v.id);
    return `
      <div class="stat-favor-row">
        <span class="stat-favor-name">${v.name}</span>
        <span class="stat-favor-level">Lvl ${fp.level}</span>
        <div class="stat-favor-bar"><div class="stat-favor-fill" style="width:${fp.progressPct}%"></div></div>
      </div>`;
  }).join('');

  const container = document.getElementById('stats-content');
  container.innerHTML = `
    <div class="stats-rank-card">
      <div class="stats-rank-label">Collector Rank</div>
      <div class="stats-rank-name">${rank.name}</div>
      <div class="stats-rank-points">${rank.current} reputation${rank.nextMin ? ` · next at ${rank.nextMin}` : ''}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${packsOpened}</div><div class="stat-label">Packs Opened</div></div>
      <div class="stat-card"><div class="stat-value">${totalCards}</div><div class="stat-label">Unique Cards</div></div>
      <div class="stat-card"><div class="stat-value">${avgCompletion.toFixed(1)}%</div><div class="stat-label">Avg. Completion</div></div>
      <div class="stat-card"><div class="stat-value">$${totalValue.toFixed(2)}</div><div class="stat-label">Collection Value</div></div>
      <div class="stat-card"><div class="stat-value">${secretRares}</div><div class="stat-label">Secret Rares</div></div>
      <div class="stat-card"><div class="stat-value">${totalDupes}</div><div class="stat-label">Duplicates</div></div>
      <div class="stat-card"><div class="stat-value">${wishlistHits}</div><div class="stat-label">Wishlist Owned</div></div>
      <div class="stat-card"><div class="stat-value stat-value--small">${favSetName}</div><div class="stat-label">Most Collected</div></div>
    </div>

    <div class="stats-section-title">Vendor Favor</div>
    <div class="stats-favor-list">${favorRows}</div>

    ${mostValCard ? `
    <div class="stats-showcase" id="showcase-most-val" style="cursor:pointer">
      <div class="stats-showcase-label">Most Valuable Card</div>
      <img src="${mostValCard.images.small || mostValCard.images.large}" alt="${mostValCard.name}" class="stats-showcase-img" />
      <div class="stats-showcase-name">${mostValCard.name}</div>
      <div class="stats-showcase-value">$${mostValAmount.toFixed(2)}</div>
    </div>` : '<p class="stats-empty">Open some packs to see your stats!</p>'}

    ${rarestCard && rarestIdx !== -1 ? `
    <div class="stats-showcase" id="showcase-rarest" style="cursor:pointer">
      <div class="stats-showcase-label">Rarest Pull</div>
      <img src="${rarestCard.images.small || rarestCard.images.large}" alt="${rarestCard.name}" class="stats-showcase-img" />
      <div class="stats-showcase-name">${rarestCard.name}</div>
      <div class="stats-showcase-value">${RARITY_LABELS[RARITY_ORDER[rarestIdx]] || ''}</div>
    </div>` : ''}
  `;

  if (mostValCard) container.querySelector('#showcase-most-val')?.addEventListener('click', () => {
    const ownedEntry = getCollection()[mostValCard.set?.id]?.[mostValCard.id] ?? null;
    openCardDetail(mostValCard, ownedEntry, mostValCard.set?.id);
  });
  if (rarestCard) container.querySelector('#showcase-rarest')?.addEventListener('click', () => {
    const ownedEntry = getCollection()[rarestCard.set?.id]?.[rarestCard.id] ?? null;
    openCardDetail(rarestCard, ownedEntry, rarestCard.set?.id);
  });
}

// ─── Wishlist screen ──────────────────────────────────────────────────────────

document.getElementById('wishlist-back-btn').onclick = closeWishlistScreen;

function openWishlistScreen() { renderWishlistScreen(); showScreen(document.getElementById('wishlist-screen')); }
function closeWishlistScreen() { hideScreen(document.getElementById('wishlist-screen')); }

function renderWishlistScreen() {
  const wishlist   = getWishlist();
  const collection = getCollection();
  const container  = document.getElementById('wishlist-content');
  container.innerHTML = '';

  if (wishlist.size === 0) {
    container.innerHTML = `
      <div class="wishlist-empty">
        <div class="wishlist-empty-icon">☆</div>
        <div class="wishlist-empty-text">No chase cards yet.</div>
        <div class="wishlist-empty-sub">Tap ☆ on any card to add it to your wishlist.</div>
      </div>`;
    return;
  }

  const grouped = {};
  for (const setId of SET_IDS) {
    const cached = getCachedSetCards(setId) || [];
    cached.forEach(apiCard => {
      if (wishlist.has(apiCard.id)) {
        if (!grouped[setId]) grouped[setId] = [];
        grouped[setId].push(apiCard);
      }
    });
  }

  if (Object.keys(grouped).length === 0) {
    container.innerHTML = `<p class="stats-empty">Wishlisted cards will appear here after the sets finish loading.</p>`;
    return;
  }

  Object.entries(grouped).forEach(([setId, cards]) => {
    const packInfo = PACK_STORE[setId];
    const section  = document.createElement('div');
    section.className = 'wishlist-section';
    section.innerHTML = `<div class="wishlist-set-name">${packInfo?.name || setId}</div>`;

    const grid = document.createElement('div');
    grid.className = 'wishlist-grid';

    cards.forEach(apiCard => {
      const ownedEntry = collection[setId]?.[apiCard.id] ?? null;
      const rarityTier = mapPokemonRarity(apiCard.rarity) || 'common';
      const value      = getMarketValue(apiCard.id, rarityTier);
      const tile = document.createElement('div');
      tile.className = `wishlist-tile ${ownedEntry ? 'wishlist-tile--owned' : ''}`;
      const imgClass = ownedEntry ? '' : 'binder-slot-img--unowned';
      tile.innerHTML = `
        <div class="wishlist-tile-img-wrap">
          <img src="${apiCard.images.small || apiCard.images.large}" alt="${apiCard.name}" class="wishlist-tile-img ${imgClass}" loading="lazy" />
          ${ownedEntry ? '<div class="wishlist-owned-badge">Owned</div>' : ''}
        </div>
        <div class="wishlist-tile-name">${apiCard.name}</div>
        <div class="wishlist-tile-value">$${value.toFixed(2)}</div>
      `;
      tile.onclick = () => openCardDetail(apiCard, ownedEntry, setId);
      grid.appendChild(tile);
    });
    section.appendChild(grid);
    container.appendChild(section);
  });
}
