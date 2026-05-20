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
} from './data/collectionManager.js';
import { getMarketValue, getAllMarketValues, enrichMarketMeta } from './data/marketValue.js';
import { isWishlisted, toggleWishlist, getWishlist } from './data/wishlistManager.js';
import { isFavorited, toggleFavorite, getFavoriteCount } from './data/favoritesManager.js';
import { openFavoritesScreen, closeFavoritesScreen, refreshFavoritesScreen } from './ui/favoritesScreen.js';
import {
  initEconomy, getCurrentTrend, getRefreshLabel, runRefresh, timeUntilRefreshMs,
  tryGenerateDailyChase,
} from './data/economyManager.js';
import {
  VENDORS, getVendorStock, getFavor, addFavor, getFavorLevel, getFavorProgress,
  isVendorOpen, getBrokerNextOpenLabel, getEffectivePackPrice,
} from './data/vendorManager.js';
import { getReputation, addReputation, getRank, getAllRanks } from './data/reputationManager.js';
import { calculateSellPayout, isSellGated, sellCard }    from './data/sellingManager.js';
import { lockBodyScroll, unlockBodyScroll, getLockDepth } from './ui/scrollManager.js';
import { onEscapeKey } from './ui/overlayScrollLock.js';
import { computeTotalCollectionValue, lineValueForCollectionEntry } from './data/collectionValuation.js';
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
import {
  getRequestsForVendor, getRefreshLabel as getRequestRefreshLabel,
  getRequestProgress, anyVendorRequestsStale,
} from './data/requestManager.js';
import { fulfillVendorRequest } from './data/requestFulfillmentManager.js';
import { getReadyMilestoneRewards, markMilestonesClaimed, getCategoryStatus } from './data/milestoneManager.js';
import { withLocalStorageRollback } from './data/localStorageTransaction.js';
import {
  getPacksOpened, incrementPacksOpened,
  incrementDuplicatesSold,
  addLifetimeRevenue,
  incrementBrokerPurchases,
} from './data/statsManager.js';
import { isInDistress, checkDistressTransition } from './data/distressManager.js';
import {
  isInRecovery, getRecoveryFocusVendor, getRecoveryFocusName,
  getRecoveryBannerMessage, canClaimRelief, getReliefCountdownLabel,
  getReliefAmount, claimReliefStipend, tickRecovery,
} from './data/recoveryManager.js';
import {
  getEmergencyRequestForVendor, getRotationLabel as getEmergencyRotationLabel,
} from './data/emergencyRequestManager.js';
import { logActivity, getActivityFeed }          from './data/activityFeed.js';
import {
  ensureQualityForCard, ensureQualityForCopy, getOrCreateQuality, isEligibleRarity,
} from './data/cardQualityManager.js';
import {
  tickSubmissions, getSlabByUid, getAgsStats, lockedCopiesFor,
  getSlabsForCard, getHighestSlabForCard,
} from './data/agsSubmissionManager.js';
import { gradedDeltaForSlab } from './data/agsMarketIntegration.js';
import { openArchiveServicesScreen, closeArchiveServicesScreen, setAgsActiveTab } from './ui/archiveServicesScreen.js';
import { openSlabViewer } from './ui/slabViewer.js';
import { renderPremiumSlab } from './ui/slabRenderer.js';
import { showAgsRevealOverlay } from './ui/agsRevealOverlay.js';
import { getSettings } from './data/settingsManager.js';
import { getPrestigeTier, addPrestigeBonus }     from './data/prestigeManager.js';
import {
  recordArchiveEvent, hasArchiveKey, getArchiveEntries,
} from './data/archiveHistoryManager.js';
import {
  tickVendorEvents, getVendorEvent, getVendorEventEffect, getVendorEventTimeLeft,
} from './data/vendorEventsManager.js';
import { tickVendorStates, getActiveGlobalState, getVendorOperationalState } from './data/vendorStateManager.js';
import { getDailyCapsules } from './data/capsuleManager.js';
import { getActiveExhibition, getCuratorRank, getEligibleMuseumCards, contributeToMuseum, getCuratorReputation } from './data/museumManager.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

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

// ─── Card augmentation + vendor identity bias (v1.2.1) ────────────────────────

// Per-vendor rarity upgrade/downgrade probabilities for the 'rare' slot.
// Only Retro Vault and Night Market have meaningful biases; PokéMart is neutral.
// Map: vendorId → { sourceRarity → { targetRarity: probability, … } }
const VENDOR_RARITY_BIAS = {
  retroVault:  { rare: { holoRare: 0.35, rare: 0.65 } },
  nightMarket: { rare: { holoRare: 0.20, uncommon: 0.10, rare: 0.70 } },
};

function applyVendorRarityBias(rarity, vendor) {
  let bias;
  if (vendor && vendor.activeCapsule && vendor.activeCapsule.rarityShaping) {
    bias = vendor.activeCapsule.rarityShaping[rarity];
  } else if (vendor) {
    bias = VENDOR_RARITY_BIAS[vendor.id]?.[rarity];
  }
  if (!bias) return rarity;
  let cum = 0;
  const roll = Math.random();
  for (const [tier, prob] of Object.entries(bias)) {
    cum += prob;
    if (roll < cum) return tier;
  }
  return rarity;
}

function augmentCards(engineCards, setId, vendor) {
  if (!isSetLoaded()) return engineCards;
  return engineCards.map((card) => {
    const biasedRarity = applyVendorRarityBias(card.rarity, vendor);
    const poolCard = getRandomCard(biasedRarity) || getRandomCard(card.rarity);
    if (!poolCard) return card;
    return { ...card, id: poolCard.id || null, setId, name: poolCard.name,
             imageUrl: poolCard.imageUrl, rarityType: poolCard.rarity,
             isReverseHolo: card.isReverseHolo };
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
   'settings-screen','help-screen',
   'progression-screen','duplicate-vault-screen','collector-archive-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.add('hidden'); }
  });
})();

// ─── Pack loading indicator ───────────────────────────────────────────────────

const showPackLoadingIndicator = () => document.getElementById('pack-loading-indicator')?.classList.remove('hidden');
const hidePackLoadingIndicator = () => document.getElementById('pack-loading-indicator')?.classList.add('hidden');

// ─── Stats persistence ── v1.2.0: delegated to data/statsManager.js ──────────
// getPacksOpened / incrementPacksOpened now imported from statsManager above.

// ─── Rarity tables ────────────────────────────────────────────────────────────

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
// v1.2.2d — scroll position saved before hiding collection-screen so it can be
// restored after re-render when returning from binder (including Broker paths).
let _collectionScrollTop = 0;
// v1.2.2e — tracks whether the binder was opened while collection-screen was
// already visible (lock depth already ≥1). closeBinderScreen uses this to
// decide whether to shed binder's extra lock or repurpose it as collection's.
let _binderCameFromCollection = false;

/** Card-detail modal Escape listener — cleared whenever the modal closes or spawns a child flow. */
let _disposeCardDetailEscape = null;
function tearDownCardDetailEscape() {
  _disposeCardDetailEscape?.();
  _disposeCardDetailEscape = null;
}

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

// ALL `const` and `let` bindings that are read inside renderVendorHub() or
// updateRankStrip() MUST live here — above the top-level renderVendorHub()
// call at module scope. Function declarations hoist fully; `const`/`let` do
// NOT. Accessing them before their declaration line throws a TDZ ReferenceError
// that silently kills module init on iOS WebKit (no visible error, all buttons
// dead). See BOX_EMBLEMS above for the documented precedent.

// v1.3.0 — glyph icons for the activity feed event types.
// v1.4.0 — extended with prestige/archive/event types.
// Required by renderVendorHub(); must stay above the call site.
const ACTIVITY_ICONS = {
  pack_opened:           '⬡',
  stipend_claimed:       '◆',
  request_fulfilled:     '✓',
  broker_purchase:       '★',
  milestone:             '✦',
  market_refresh:        '↻',
  broker_arrived:        '◐',
  prestige_pull:         '✧',
  wishlist_hit:          '♥',
  vendor_event:          '◌',
  archive_event:         '⌖',
  reverse_holo_complete: '◉',
  recovery_survived:     '⤴',
  prestige_tier_up:      '⬢',
  ags_submitted:         '⌬',
  ags_complete:          '◈',
  ags_pristine:          '✦',
  ags_black_label:       '◆',
  archive_record:        '⌖',
  favorited:             '♥',
  unfavorited:           '♡',
};

// v1.5.0 — expose per-copy quality lookup to UI helpers (avoids circular import).
// Phase 1 foundation vendors. Static, low-cost data shells for future economy
// systems: capsule drops, archival requests, and auction lots can replace these
// arrays without changing the shared vendor card frame.
const FOUNDATION_VENDOR_IDS = new Set(['capsuleCorner', 'museumExchange', 'estateAuctions']);

const CAPSULE_CORNER_DROPS = [
  {
    name: 'Collector Capsule',
    tag: 'Measured',
    price: 12,
    bias: 'Balanced rarity distribution',
    signal: 'Elevated illustration-rare probability detected.',
    rewards: ['Modern sealed pull table', 'Low duplicate filtering', 'Hidden chase variance'],
  },
  {
    name: 'Prism Capsule',
    tag: 'Volatile',
    price: 18,
    bias: 'High shine outcome bias',
    signal: 'Foil and texture clustering above baseline.',
    rewards: ['Reverse holo drift', 'Gallery slot pressure', 'Short-run stock'],
  },
  {
    name: 'Distortion Capsule',
    tag: 'Unstable',
    price: 24,
    bias: 'Wide reward spread',
    signal: 'High-value potential confirmed. Outcome confidence reduced.',
    rewards: ['Rare downgrade risk', 'Secret rare potential', 'Erratic grade outcomes'],
  },
  {
    name: 'Archive Capsule',
    tag: 'Scarce',
    price: 32,
    bias: 'Archive-weighted capsule series',
    signal: 'Distributor remainder seal pattern authenticated.',
    rewards: ['Legacy set echoes', 'Prestige record chance', 'Limited dispenses'],
  },
];

const MUSEUM_EXCHANGE_REQUESTS = [
  { title: 'Seeking vintage illustration rares.', meta: 'Reward: Archive Points + Prestige', progress: '2 / 5' },
  { title: 'Exhibition request: Psychic-type full arts.', meta: 'Reward: Reputation + Bonus Payout', progress: '1 / 3' },
  { title: 'Curator acquisition program active.', meta: 'Reward: Exclusive Archive item', progress: '0 / 4' },
];

const ESTATE_AUCTION_LOTS = [
  {
    lot: 'Lot #7A-19',
    title: 'Elite Archive Variant',
    cardName: 'Charizard ex',
    rarity: 'Special Illustration Rare',
    note: 'Estate liquidation now active.',
    estimate: '$4,250 - $6,100',
    attention: 7,
    ends: '02h 41m',
  },
];

const FOUNDATION_OPERATIONAL_NOTICES = {
  capsuleCorner: {
    title: 'Distribution Notice',
    body: 'Additional capsule lines initializing soon.',
    meta: 'Extended inventory pending authorization',
  },
  museumExchange: {
    title: 'Preservation Notice',
    body: 'Additional exhibition programs are currently under restoration.',
    meta: 'Curator acquisition systems expanding',
  },
  estateAuctions: {
    title: 'Access Notice',
    body: 'Private collector channels are opening gradually.',
    meta: 'Additional liquidation lots pending verification',
  },
};

window.__rb_getOrCreateQuality = getOrCreateQuality;

// v1.5.0 — AGS reveal queue + screen hooks. ALL of these MUST stay in the
// hoisting zone above the top-level renderVendorHub() call (~line 619) — the
// AGS button wiring resolves AGS_SCREEN_HOOKS at module init, and any future
// reference from renderVendorHub or updateRankStrip would otherwise TDZ-throw
// on iOS WebKit.
const _agsRevealQueue = [];
let _agsRevealActive = false;
let _agsRevealSafetyTimer = null;
/** Prevents stacking multiple body locks when openAgsScreen is invoked repeatedly. */
let _agsHubScrollLockHeld = false;
const AGS_SCREEN_HOOKS = {
  getBalance,
  spendBalance,
  addBalance,
  onBalanceChanged: updateBalanceUI,
  logActivity,
  showToast,
  haptic,
};
function openAgsScreen() {
  if (!_agsHubScrollLockHeld) {
    lockBodyScroll();
    _agsHubScrollLockHeld = true;
  }
  openArchiveServicesScreen(AGS_SCREEN_HOOKS);
}
function enqueueAgsReveals(slabs, reducedMotion) {
  for (const slab of slabs) {
    _agsRevealQueue.push({ slab, reducedMotion });

    // Activity feed + prestige + archive hooks per slab.
    try {
      const apiName = (() => {
        const cached = getCachedSetCards(slab.setId) || [];
        return cached.find(c => c.id === slab.cardId)?.name || slab.cardId;
      })();
      const tierId = slab.grade?.tier?.id;
      logActivity('ags_complete',
        `AGS · ${apiName} certified ${slab.grade?.label || ''}`);

      if (tierId === 'BLACK_LABEL') {
        addPrestigeBonus(200);
        logActivity('ags_black_label',
          `AGS BLACK LABEL · ${apiName} preserved.`);
        recordArchiveEvent('ags_black_label',
          `AGS BLACK LABEL certified — ${apiName}`,
          { key: 'first_black_label' });
      } else if (tierId === 'AGS_10') {
        addPrestigeBonus(60);
        logActivity('ags_pristine',
          `AGS · Archive Pristine — ${apiName}`);
        recordArchiveEvent('ags_pristine',
          `First AGS 10 certified — ${apiName}`,
          { key: 'first_ags_10' });
      } else if (tierId === 'AGS_9_5') {
        addPrestigeBonus(25);
        recordArchiveEvent('ags_pristine',
          `First AGS 9.5 certified — ${apiName}`,
          { key: 'first_ags_9_5' });
      }
    } catch (err) { console.error('[v1.5.0] ags hook failed:', err); }
  }
  _drainAgsRevealQueue();
}
function _drainAgsRevealQueue() {
  if (_agsRevealActive || _agsRevealQueue.length === 0) return;
  const { slab, reducedMotion } = _agsRevealQueue.shift();
  const cached  = getCachedSetCards(slab.setId) || [];
  const apiCard = cached.find(c => c.id === slab.cardId) || { name: slab.cardId };
  _agsRevealActive = true;

  // Safety failsafe — if the overlay never fires onClose (user navigates
  // away, exception inside the overlay, etc.), force-reset after 60s so
  // future completions still surface. Cleared on a clean onClose.
  const finish = () => {
    if (_agsRevealSafetyTimer) {
      clearTimeout(_agsRevealSafetyTimer);
      _agsRevealSafetyTimer = null;
    }
    if (!_agsRevealActive) return;
    _agsRevealActive = false;
    _drainAgsRevealQueue();
  };
  _agsRevealSafetyTimer = setTimeout(() => {
    console.warn('[v1.5.0] ags reveal safety timeout — force-draining queue.');
    finish();
  }, 60_000);

  try {
    haptic('heavy');
    showAgsRevealOverlay(slab, apiCard, { reducedMotion, onClose: finish });
  } catch (err) {
    console.error('[v1.5.0] ags reveal overlay failed:', err);
    finish();
  }
}

// v1.4.0 — Prestige pull atmospheric text rotation. Picked deterministically
// per pull (timestamp seed) so the same hit doesn't get the same line twice
// in rapid succession but doesn't repeat-spam either.
const PRESTIGE_PULL_LINES = [
  'Archive-worthy acquisition.',
  'Market demand expected to rise.',
  'The Broker would pay heavily for this.',
  'Preservation recommended.',
  'An extraordinary pull.',
  'Collector interest detected.',
  'A pull worth remembering.',
  'Quality consistent with archive standards.',
];

// v1.4.0 — vendor display names for archive/event entries (avoids importing twice).
const VENDOR_DISPLAY = {
  pokemart:    'PokéMart',
  retroVault:  'Retro Vault',
  nightMarket: 'Night Market',
  broker:      'The Broker',
};

// v1.4.0 — temporary milestone-granted vendor discounts.
//   { [vendorId]: { pct: 0.05, expiresAt: Date.now()+ms } }
// Read by getEffectiveVendorPrice() at pricing time. Pure-additive layer
// over getEffectivePackPrice — does not mutate the underlying vendor stock.
const _tempVendorDiscounts = {};
function applyTempVendorDiscount(vendorId, pct, durationMs) {
  if (!vendorId || !pct || !durationMs) return;
  _tempVendorDiscounts[vendorId] = {
    pct: Math.max(0, Math.min(0.5, pct)),
    expiresAt: Date.now() + durationMs,
  };
}
function getTempVendorDiscount(vendorId) {
  const d = _tempVendorDiscounts[vendorId];
  if (!d) return 0;
  if (Date.now() >= d.expiresAt) { delete _tempVendorDiscounts[vendorId]; return 0; }
  return d.pct;
}

// v1.4.0 — prestige rarity set. These trigger the Prestige Pull treatment.
const PRESTIGE_PULL_TIERS = new Set([
  'illustrationRare', 'specialIllustrationRare', 'hyperRare',
]);

// v1.3.0 — Prestige tiers for updateRankStrip(). Must stay above the call site.
const PRESTIGE_RANKS = new Set([
  'Master Collector', 'Archive Curator', 'Legendary Collector',
]);

// _vendorObserver: same rule — keep above the call site.
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
  // v1.3.0a — recovery tick first: handles 45-min focus rotation while in
  // recovery AND post-recovery cleanup of leftover emergency/state storage.
  // Returns true when a hub re-render is needed.
  const wasInRecovery = isInRecovery();
  const recoveryNeedsRender = tickRecovery();
  // v1.4.0 — log recovery survival to archive history (deduped by date+approx).
  if (wasInRecovery && !isInRecovery()) {
    try {
      const dayKey = new Date().toISOString().slice(0, 10);
      recordArchiveEvent('recovery_survived',
        'Weathered Recovery Mode — collection intact.',
        { key: `recovery_survived:${dayKey}` });
      logActivity('recovery_survived', 'Recovery Mode cleared');
    } catch {}
  }

  // v1.4.0 — vendor world events: subtle, infrequent rotation. Returns true
  // when an event slot started/ended so the hub re-renders to surface the
  // banner change.
  const vendorEventsChanged = tickVendorEvents();
  const vendorStatesChanged = tickVendorStates();

  // v1.5.0 — AGS submission queue. Promotes any active submission whose
  // returnAt has elapsed into the registry, then triggers the cinematic
  // reveal overlay (queued sequentially if multiple complete on one tick).
  try {
    const completed = tickSubmissions();
    if (completed.length > 0) {
      const reduced = !!getSettings().reducedMotion;
      enqueueAgsReveals(completed, reduced);
      try { recordCollectionValueSnapshot(); } catch {}
      // Notify any open AGS screen so it re-renders.
      document.dispatchEvent(new CustomEvent('ags-tick'));
    } else {
      // Even with no completions, re-render the AGS screen so timers tick.
      document.dispatchEvent(new CustomEvent('ags-tick'));
    }
  } catch (err) { console.error('[v1.5.0] ags tick failed:', err); }

  if (timeUntilRefreshMs() === 0) {
    runRefresh();
    renderVendorHub();
    renderChaseStrip();
    showToast(`Market refreshed: ${getCurrentTrend().label}`, 'refresh');
  } else if (recoveryNeedsRender || vendorEventsChanged || anyVendorRequestsStale()) {
    // Phase 10.4 — vendor request rotations have their own cadence
    // (2-8h) independent of the market refresh cycle. Re-render the
    // hub so newly-rotated requests appear without manual reload.
    // v1.3.0a — also re-renders on recovery focus rotation / cleanup.
    // v1.4.0 — also re-renders on vendor world event start/end.
    renderVendorHub();
  }
  updateMarketStrip();
  renderStipendStrip();
  renderChaseStrip();
}, 30 * 1000);

// v1.4.0 — initial event tick on boot so the first render reflects active state.
try { tickVendorEvents(); } catch (err) { console.error('[v1.4.0] vendor events tick failed:', err); }

function updateMarketStrip() {
  const trend = getCurrentTrend();
  const lblT  = document.getElementById('market-trend-label');
  const lblR  = document.getElementById('market-refresh-label');
  if (lblT) lblT.textContent = trend.label;
  if (lblR) lblR.textContent = getRefreshLabel();
}

function updateRankStrip() {
  const rank   = getRank();
  const strip  = document.getElementById('rank-strip');
  const nameEl = document.getElementById('rank-name');
  const fill   = document.getElementById('rank-bar-fill');
  if (nameEl) nameEl.textContent = `${rank.name} · ${rank.current} pts`;
  if (fill)   fill.style.width   = rank.progressPct + '%';
  // v1.3.0 — Prestige tier accents (gold) for Master+/Curator/Legendary
  if (strip) {
    if (PRESTIGE_RANKS.has(rank.name)) strip.classList.add('is-prestige');
    else                               strip.classList.remove('is-prestige');
  }
}

// Phase 10.5 — make rank strip clickable to open Collector Progression
(function wireRankStrip() {
  const strip = document.getElementById('rank-strip');
  if (!strip) return;
  strip.classList.add('is-clickable');
  strip.setAttribute('role', 'button');
  strip.setAttribute('aria-label', 'View Collector Progression');
  strip.addEventListener('click', () => openCollectorArchive());
  iosTap(strip, () => openCollectorArchive());
})();

// ─── Collector Progression screen (Phase 10.5) ───────────────────────────────

const RANK_PERKS = {
  'Rookie Collector': [
    'Starter Collector Grant ($120)',
    'Daily stipend unlocked',
    'Open Requests from PokéMart and Night Market',
    'Recovery Mode safety net activates below $8',
  ],
  'Collector': [
    'Holo-tier requests appear at all vendors',
    'Retro Vault Archive Requests unlock',
    'Slightly larger Night Market discounts',
    'Retro Vault accepts Recovery Mode emergencies',
  ],
  'Advanced Collector': [
    'Double Rare requests unlock',
    'Broker Collector Bounties become available',
    'Set-acquisition requests appear at Retro Vault',
    'Higher daily stipend ($28 base)',
  ],
  'Elite Collector': [
    'Illustration Rare requests appear',
    'Higher demand multipliers on Night Market',
    'Mystery Box rotations preview earlier',
    'Stipend climbs to $40 base',
  ],
  'Master Collector': [
    'Ultra Rare requests appear',
    'Broker Prestige Acquisitions begin',
    'Premium contract bonuses (+15-30%)',
    'Broker Prestige Liquidations during Recovery Mode',
  ],
  'Archive Curator': [
    'Special Illustration Rare contracts',
    'Museum Acquisition prestige flavor',
    'Top-tier Broker payouts',
    'Stipend reaches $58-62 daily',
  ],
  'Legendary Collector': [
    'Hyper Rare prestige acquisitions',
    'Maximum contract bonuses (+25-40%)',
    'Full vendor ecosystem access',
    'Maximum stipend tier ($60-65 daily)',
  ],
};

function openCollectorProgression() {
  const el = document.getElementById('progression-screen');
  if (!el) return;
  renderCollectorProgression();
  lockBodyScroll();
  showScreen(el);
}
function closeCollectorProgression() {
  hideScreen(document.getElementById('progression-screen'));
  unlockBodyScroll();
}

// ─── v1.2.0 — Collector Archive (milestones + rank timeline) ─────────────────

function openCollectorArchive() {
  const el = document.getElementById('collector-archive-screen');
  if (!el) return;
  renderCollectorArchive(el);
  lockBodyScroll();
  showScreen(el);
}

function closeCollectorArchive() {
  hideScreen(document.getElementById('collector-archive-screen'));
  unlockBodyScroll();
}

function renderCollectorArchive(el) {
  const cur    = getRank();
  const ranks  = getAllRanks();
  const cats   = getCategoryStatus();
  const points = cur.current;

  // Rank timeline rows (reused from renderCollectorProgression)
  const rankRows = ranks.map((r, i) => {
    const next      = ranks[i + 1];
    const isCurrent = r.name === cur.name;
    const isReached = points >= r.min;
    const isLocked  = !isReached;
    const perks     = RANK_PERKS[r.name] || [];
    const reqLine   = i === 0 ? 'Starting rank' : `${r.min} reputation`;
    const span      = next ? `${r.min}–${next.min - 1}` : `${r.min}+`;
    return `
      <li class="prog-row ${isCurrent ? 'is-current' : ''} ${isLocked ? 'is-locked' : 'is-reached'}">
        <div class="prog-marker"><span class="prog-dot"></span></div>
        <div class="prog-card">
          <div class="prog-card-head">
            <span class="prog-rank-name">${r.name}</span>
            ${isCurrent ? '<span class="prog-current-tag">CURRENT</span>' : ''}
            ${isLocked && !isCurrent ? '<span class="prog-locked-tag">LOCKED</span>' : ''}
          </div>
          <div class="prog-rank-req">${reqLine} · band ${span}</div>
          ${r.description ? `<div class="prog-rank-desc-line">${r.description}</div>` : ''}
          <ul class="prog-perks">${perks.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      </li>`;
  }).join('');

  // Milestone category sections
  const catSections = cats.map(cat => {
    const milestoneCards = cat.milestones.map(m => {
      if (!m.revealed) {
        return `<div class="archive-milestone archive-milestone--hidden"><span class="archive-milestone-lock">◈</span><span>Complete previous milestones to reveal</span></div>`;
      }
      const displayCurrent = m.displayFn ? m.displayFn(m.current) : m.current;
      const displayTarget  = m.displayFn ? m.displayFn(m.target)  : m.target;
      const pct = m.progressPct.toFixed(0);
      const rewardParts = [];
      if (m.rewardCash) rewardParts.push(`+$${m.rewardCash}`);
      if (m.rewardRep)  rewardParts.push(`+${m.rewardRep} rep`);
      if (m.rewardNote) rewardParts.push(m.rewardNote);
      const rewardStr = rewardParts.join(' · ') || 'Achievement';
      return `
        <div class="archive-milestone ${m.claimed ? 'archive-milestone--claimed' : m.claimable ? 'archive-milestone--claimable' : ''}">
          <div class="archive-milestone-head">
            <span class="archive-milestone-title">${m.title}</span>
            ${m.claimed ? '<span class="archive-milestone-badge">✓</span>' : ''}
          </div>
          <div class="archive-milestone-desc">${m.desc}</div>
          <div class="archive-milestone-progress">
            <div class="archive-milestone-bar"><div class="archive-milestone-fill" style="width:${pct}%"></div></div>
            <span class="archive-milestone-nums">${displayCurrent} / ${displayTarget}</span>
          </div>
          <div class="archive-milestone-reward">${rewardStr}</div>
        </div>`;
    }).join('');
    const completedPct = cat.totalCount > 0 ? Math.round(cat.completedCount / cat.totalCount * 100) : 0;
    return `
      <div class="archive-category" data-cat="${cat.id}">
        <button class="archive-cat-head">
          <span class="archive-cat-icon">${cat.icon}</span>
          <span class="archive-cat-label">${cat.label}</span>
          <span class="archive-cat-count">${cat.completedCount} / ${cat.totalCount}</span>
          <span class="archive-cat-pct">${completedPct}%</span>
          <span class="archive-cat-chevron">+</span>
        </button>
        <div class="archive-cat-body">${milestoneCards}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="screen-header">
      <button class="screen-back-btn" id="archive-back-btn">← Back</button>
      <h2>Collector Archive</h2>
      <div></div>
    </div>
    <div class="archive-body">
      <div class="archive-rank-card">
        <div class="archive-rank-name">${cur.name}</div>
        ${cur.description ? `<div class="archive-rank-desc">${cur.description}</div>` : ''}
        <div class="archive-rank-bar"><div class="archive-rank-fill" style="width:${cur.progressPct.toFixed(1)}%"></div></div>
        <div class="archive-rank-pts">${cur.current.toLocaleString()} reputation${cur.nextMin ? ` · ${cur.nextMin.toLocaleString()} to next rank` : ' · maximum rank reached'}</div>
      </div>
      <div class="archive-section-title">Milestones</div>
      ${catSections}
      <div class="archive-section-title">Rank Progression</div>
      <ol class="progression-timeline">${rankRows}</ol>
    </div>
  `;

  const back = el.querySelector('#archive-back-btn');
  back.onclick = closeCollectorArchive;
  iosTap(back, closeCollectorArchive);

  el.querySelectorAll('.archive-cat-head').forEach(head => {
    head.addEventListener('click', () => {
      const cat  = head.closest('.archive-category');
      const open = cat.classList.toggle('is-open');
      head.querySelector('.archive-cat-chevron').textContent = open ? '−' : '+';
      haptic('soft');
    });
  });
}

function renderCollectorProgression() {
  const el = document.getElementById('progression-screen');
  if (!el) return;
  const cur   = getRank();
  const ranks = getAllRanks();
  const points = cur.current;

  const rows = ranks.map((r, i) => {
    const next = ranks[i + 1];
    const isCurrent  = r.name === cur.name;
    const isReached  = points >= r.min;
    const isLocked   = !isReached;
    const perks      = RANK_PERKS[r.name] || [];
    const reqLine    = i === 0 ? 'Starting rank' : `${r.min} reputation`;
    const span       = next ? `${r.min}–${next.min - 1}` : `${r.min}+`;
    return `
      <li class="prog-row ${isCurrent ? 'is-current' : ''} ${isLocked ? 'is-locked' : 'is-reached'}">
        <div class="prog-marker"><span class="prog-dot"></span></div>
        <div class="prog-card">
          <div class="prog-card-head">
            <span class="prog-rank-name">${r.name}</span>
            ${isCurrent ? '<span class="prog-current-tag">CURRENT</span>' : ''}
            ${isLocked && !isCurrent ? '<span class="prog-locked-tag">LOCKED</span>' : ''}
          </div>
          <div class="prog-rank-req">${reqLine} · band ${span}</div>
          <ul class="prog-perks">
            ${perks.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>
      </li>
    `;
  }).join('');

  el.innerHTML = `
    <div class="screen-header">
      <button class="screen-back-btn" id="progression-back-btn">← Back</button>
      <h2>Collector Progression</h2>
      <div></div>
    </div>
    <div class="progression-body">
      <div class="progression-summary">
        <div class="progression-summary-rank">${cur.name}</div>
        <div class="progression-summary-points">${cur.current} reputation${cur.nextMin ? ` · next at ${cur.nextMin}` : ' · max rank'}</div>
        <div class="progression-summary-bar"><div class="progression-summary-fill" style="width:${cur.progressPct}%"></div></div>
      </div>
      <ol class="progression-timeline">${rows}</ol>
    </div>
  `;
  const back = el.querySelector('#progression-back-btn');
  back.onclick = closeCollectorProgression;
  iosTap(back, closeCollectorProgression);
}

// ─── Duplicate Vault screen (Phase 10.5) ─────────────────────────────────────

// v1.3.0 — Vault virtualization observer is held at module scope so it can be
// disconnected on close / re-render, preventing lingering observers if the
// player exits the screen mid-scroll.
let _vaultObserver = null;

function openDuplicateVault() {
  const el = document.getElementById('duplicate-vault-screen');
  if (!el) return;
  renderDuplicateVault();
  lockBodyScroll();
  showScreen(el);
}
function closeDuplicateVault() {
  if (_vaultObserver) { _vaultObserver.disconnect(); _vaultObserver = null; }
  hideScreen(document.getElementById('duplicate-vault-screen'));
  unlockBodyScroll();
}

function renderDuplicateVault() {
  const el = document.getElementById('duplicate-vault-screen');
  if (!el) return;
  const collection = getCollection();
  const allValues  = getAllMarketValues();

  // Gather all duplicates (count > 1). Skip wishlisted entries — those are
  // chase cards the player explicitly wants to keep visible elsewhere.
  const items = [];
  for (const [setId, cards] of Object.entries(collection)) {
    const cached = getCachedSetCards(setId) || [];
    const byId   = Object.fromEntries(cached.map(c => [c.id, c]));
    const setName = PACK_STORE[setId]?.name || setId;
    for (const [cardId, entry] of Object.entries(cards)) {
      if (entry.count <= 1) continue;
      const dups   = entry.count - 1;
      const apiCard = byId[cardId];
      const tier   = apiCard ? mapPokemonRarity(apiCard.rarity) : 'common';
      const value  = allValues[cardId] ?? getMarketValue(cardId, tier);
      items.push({
        setId, cardId, entry, dups, value, tier,
        name:  apiCard?.name || cardId,
        image: apiCard?.images?.small || apiCard?.images?.large || '',
        setName,
        rarityLabel: RARITY_LABELS[tier] || tier,
        totalDupValue: dups * value,
      });
    }
  }
  // Sort by total duplicate value descending — most-valuable backlog first.
  items.sort((a, b) => b.totalDupValue - a.totalDupValue);

  const totalDupes      = items.reduce((s, x) => s + x.dups, 0);
  const totalDupesValue = items.reduce((s, x) => s + x.totalDupValue, 0);

  // v1.3.0 — windowed virtualization. Render an initial PAGE of rows; an
  // IntersectionObserver on the trailing sentinel appends the next PAGE
  // when the user scrolls near the bottom. Keeps DOM small for players
  // with hundreds of duplicates.
  const PAGE = 30;

  const renderRow = (x) => `
        <div class="vault-row" data-set="${x.setId}" data-card="${x.cardId}">
          <div class="vault-thumb">
            ${x.image ? `<img src="${x.image}" alt="${x.name}" loading="lazy" />` : '<div class="vault-thumb-placeholder">?</div>'}
            <span class="vault-qty">×${x.dups}</span>
          </div>
          <div class="vault-info">
            <div class="vault-name">${x.name}</div>
            <div class="vault-meta">
              <span class="vault-rarity">${x.rarityLabel}</span>
              <span class="vault-set">${x.setName}</span>
            </div>
            <div class="vault-value">est. $${x.value.toFixed(2)} ea · $${x.totalDupValue.toFixed(2)} total</div>
          </div>
          <div class="vault-actions">
            <button class="vault-btn vault-btn--locate" data-act="locate">Open in Binder</button>
          </div>
        </div>`;

  const initialItems = items.slice(0, PAGE);
  const remaining    = Math.max(0, items.length - PAGE);

  const list = items.length === 0
    ? `<div class="vault-empty">
         <div class="vault-empty-icon">◆</div>
         <div class="vault-empty-text">No duplicates yet.</div>
         <div class="vault-empty-sub">Open packs to build a duplicate backlog.</div>
       </div>`
    : initialItems.map(renderRow).join('') +
      (remaining > 0
        ? `<div class="vault-sentinel" data-rendered="${PAGE}">Loading more…</div>`
        : '');

  el.innerHTML = `
    <div class="screen-header">
      <button class="screen-back-btn" id="vault-back-btn">← Back</button>
      <h2>Duplicate Vault</h2>
      <div></div>
    </div>
    <div class="vault-body">
      <div class="vault-summary">
        <div class="vault-summary-row">
          <span class="vault-summary-label">Total duplicates</span>
          <span class="vault-summary-value">${totalDupes}</span>
        </div>
        <div class="vault-summary-row">
          <span class="vault-summary-label">Estimated backlog value</span>
          <span class="vault-summary-value">$${totalDupesValue.toFixed(2)}</span>
        </div>
        <div class="vault-summary-hint">
          Sole copies and locked last-copies are never shown here. Use vendor
          requests for premium payouts, or open in binder to sell directly.
        </div>
      </div>
      <div class="vault-list">${list}</div>
    </div>
  `;

  const back = el.querySelector('#vault-back-btn');
  back.onclick = closeDuplicateVault;
  iosTap(back, closeDuplicateVault);

  // Wire row actions for the *currently rendered* set; re-invoked after each
  // batch is appended so newly added rows pick up the locate handler.
  const wireRows = (root) => {
    root.querySelectorAll('.vault-row:not([data-wired])').forEach(row => {
      row.setAttribute('data-wired', '1');
      const setId  = row.dataset.set;
      const cardId = row.dataset.card;
      const locate = row.querySelector('[data-act="locate"]');
      if (locate) {
        const handler = () => {
          closeDuplicateVault();
          closeStatsScreen();
          openBinderScreen(setId, cardId);
        };
        locate.addEventListener('click', handler);
        iosTap(locate, handler);
      }
    });
  };
  const listEl = el.querySelector('.vault-list');
  wireRows(listEl);

  // Sentinel-driven pagination: when sentinel is visible, append the next PAGE
  // and re-wire any new rows. When everything is rendered, remove the sentinel.
  // Disconnect any prior observer (re-render or stale open).
  if (_vaultObserver) { _vaultObserver.disconnect(); _vaultObserver = null; }

  if (remaining > 0 && 'IntersectionObserver' in window) {
    _vaultObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const sentinel = entry.target;
        const rendered = parseInt(sentinel.dataset.rendered || '0', 10);
        const nextEnd  = Math.min(items.length, rendered + PAGE);
        const batch    = items.slice(rendered, nextEnd);
        if (batch.length === 0) {
          if (_vaultObserver) { _vaultObserver.disconnect(); _vaultObserver = null; }
          sentinel.remove();
          return;
        }
        const frag = document.createElement('div');
        frag.innerHTML = batch.map(renderRow).join('');
        // Insert each child before sentinel
        while (frag.firstChild) listEl.insertBefore(frag.firstChild, sentinel);
        sentinel.dataset.rendered = String(nextEnd);
        wireRows(listEl);
        if (nextEnd >= items.length) {
          if (_vaultObserver) { _vaultObserver.disconnect(); _vaultObserver = null; }
          sentinel.remove();
        }
      }
    }, { root: null, rootMargin: '300px', threshold: 0.01 });
    const sentinel = listEl.querySelector('.vault-sentinel');
    if (sentinel) _vaultObserver.observe(sentinel);
  }
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
        logActivity('stipend_claimed', `Daily stipend +$${got}`);
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

  // v1.3.0a — Recovery Mode banner (was: v1.2.0 distress banner)
  // Dynamic per-vendor flavor + Vendor Relief Stipend failsafe.
  if (isInRecovery()) {
    checkDistressTransition();
    const focusName    = getRecoveryFocusName();
    const message      = getRecoveryBannerMessage()
                       || 'Balance below $8 — sell duplicates or fulfill a vendor request to recover.';
    const reliefReady  = canClaimRelief();
    const reliefLabel  = reliefReady
      ? `Claim $${getReliefAmount()} Relief`
      : `Relief in ${getReliefCountdownLabel()}`;

    const banner = document.createElement('div');
    banner.className = 'distress-banner distress-banner--enhanced';
    banner.innerHTML = `
      <div class="distress-banner-icon">
        ◈<span class="distress-warning-dot" aria-hidden="true"></span>
      </div>
      <div class="distress-banner-body">
        <div class="distress-banner-title">Recovery Mode${focusName ? ` · ${focusName}` : ''}</div>
        <div class="distress-banner-sub">${message}</div>
      </div>
      <button class="distress-relief-btn ${reliefReady ? 'is-ready' : ''}" ${reliefReady ? '' : 'disabled'}>
        ${reliefLabel}
      </button>
    `;
    const reliefBtn = banner.querySelector('.distress-relief-btn');
    if (reliefBtn && reliefReady) {
      const doClaim = () => {
        const amt = claimReliefStipend();
        if (amt > 0) {
          haptic('soft');
          sfx.purchase();
          showToast(`Vendor Relief claimed · +$${amt}`, 'sell');
          logActivity('stipend_claimed', `Vendor Relief +$${amt}`);
          updateBalanceUI();
          checkDistressTransition();
          renderVendorHub();
        }
      };
      reliefBtn.onclick = doClaim;
      iosTap(reliefBtn, doClaim);
    }
    container.appendChild(banner);
  }

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

  // v1.2.1 — World Activity feed anchored below vendor cards
  // v1.3.0 — per-event glyph icon for visual scanning
  const feedEvents = getActivityFeed(5);
  if (feedEvents.length > 0) {
    const feedEl = document.createElement('div');
    feedEl.className = 'activity-feed';
    feedEl.innerHTML =
      `<div class="activity-feed-head">Recent Activity</div>` +
      feedEvents.map(ev =>
        `<div class="activity-event activity-event--${ev.type}">` +
        `<span class="activity-event-icon" aria-hidden="true">${ACTIVITY_ICONS[ev.type] || '·'}</span>` +
        `<span class="activity-event-label">${ev.label}</span>` +
        `<span class="activity-event-time">${formatRelativeTime(ev.ts)}</span>` +
        `</div>`
      ).join('');
    container.appendChild(feedEl);
  }
}


function renderVendorCard(vendor) {
  const open      = isVendorOpen(vendor.id);
  const stock     = getVendorStock(vendor.id);
  const favor     = getFavorProgress(vendor.id);
  const opState   = getVendorOperationalState(vendor.id);
  const glowClass = opState ? `vendor-glow-${opState.glow}` : '';

  const section = document.createElement('div');
  section.className = `vendor-card vendor-${vendor.theme} ${open ? '' : 'vendor-closed'} ${glowClass}`;
  section.setAttribute('data-vendor-id', vendor.id);

  // Header
  const header = document.createElement('div');
  header.className = 'vendor-header';
  header.innerHTML = `
    <div class="vendor-header-text">
      <div class="vendor-name-row" style="display:flex; align-items:center; gap:8px;">
        <div class="vendor-name">${vendor.name}</div>
        ${opState && opState.id !== 'active' ? `<div class="vendor-op-pill vendor-op-pill--${opState.glow}">${opState.label}</div>` : ''}
      </div>
      <div class="vendor-tagline">${vendor.tagline}</div>
      ${opState && opState.notice && opState.id !== 'active' ? `<div class="vendor-op-notice">${opState.notice}</div>` : ''}
    </div>
    <div class="vendor-favor-pill">Lvl ${favor.level}</div>
  `;
  section.appendChild(header);

  // Body — different layouts per vendor
  const body = document.createElement('div');
  body.className = 'vendor-body';

  if (FOUNDATION_VENDOR_IDS.has(vendor.id)) {
    body.appendChild(renderFoundationVendorBody(vendor));
  } else if (!open && vendor.id === 'broker') {
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
  if (!FOUNDATION_VENDOR_IDS.has(vendor.id) && (open || vendor.id !== 'broker')) try {
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

  // v1.4.0 — Vendor World Event banner (subtle, single line, between body and requests).
  try {
    const ev = getVendorEvent(vendor.id);
    if (ev) {
      const banner = document.createElement('div');
      banner.className = `vendor-event-banner vendor-event-${vendor.id}`;
      const msLeft = getVendorEventTimeLeft(vendor.id);
      const hrs    = Math.max(0, Math.floor(msLeft / 3600000));
      const mins   = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
      const left   = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      banner.innerHTML = `
        <span class="vendor-event-glyph">◌</span>
        <div class="vendor-event-text">
          <div class="vendor-event-title">${ev.title}</div>
          <div class="vendor-event-flavor">${ev.flavor}</div>
        </div>
        <span class="vendor-event-timer">${left}</span>
      `;
      section.appendChild(banner);
    }
  } catch (evErr) {
    console.error('[vendorCard] event banner failed for', vendor.id, evErr);
  }

  // Phase 10.4 — Collector Requests panel (above favor footer)
  // v1.3.0a — also surfaces an Emergency Request when this vendor holds the recovery focus.
  try {
    const knownSetIds  = (stock.packs || []).map(p => p.setId);
    const reqs         = getRequestsForVendor(vendor.id, knownSetIds, getRank().name);
    const emergencyReq = getEmergencyRequestForVendor(vendor.id);
    if (!FOUNDATION_VENDOR_IDS.has(vendor.id) && (reqs.length > 0 || emergencyReq)) {
      section.appendChild(renderRequestsPanel(vendor, reqs, emergencyReq));
    }
  } catch (reqErr) {
    console.error('[vendorCard] requests panel failed for', vendor.id, reqErr);
  }

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

function renderFoundationVendorBody(vendor) {
  if (vendor.id === 'capsuleCorner') return renderCapsuleCornerFoundation(vendor);
  if (vendor.id === 'museumExchange') return renderMuseumExchangeFoundation(vendor);
  if (vendor.id === 'estateAuctions') return renderEstateAuctionsFoundation(vendor);
  const fallback = document.createElement('div');
  fallback.className = 'vendor-empty';
  fallback.textContent = 'Foundation initializing...';
  return fallback;
}

function attachFoundationButton(btn, vendor, label) {
  const action = () => {
    haptic('soft');
    sfx.click();
    showToast(`${vendor.name} foundation online - ${label}`, 'rep');
    logActivity('vendor_event', `${vendor.name} - ${label}`);
  };
  btn.onclick = action;
  iosTap(btn, action);
}

function renderCountdownPill(label, value) {
  return `<span class="foundation-countdown"><span>${label}</span>${value}</span>`;
}

function renderRarityEventTag(text, tone = '') {
  return `<span class="foundation-event-tag ${tone ? `foundation-event-tag--${tone}` : ''}">${text}</span>`;
}

function renderCollectorNotice(title, body, meta = '') {
  return `
    <div class="collector-notice">
      <div class="collector-notice-title">${title}</div>
      <div class="collector-notice-body">${body}</div>
      ${meta ? `<div class="collector-notice-meta">${meta}</div>` : ''}
    </div>
  `;
}

function renderCapsuleCornerFoundation(vendor) {
  const wrap = document.createElement('div');
  wrap.className = 'foundation-vendor foundation-capsule';
  const capsules = getDailyCapsules();
  
  wrap.innerHTML = `
    <div class="foundation-status-row">
      ${renderRarityEventTag('System Online', 'cyan')}
      ${renderCountdownPill('Refresh', '18:42:17')}
    </div>
    <div class="capsule-chamber">
      <div class="capsule-chamber-core">
        <span></span><span></span><span></span>
      </div>
      <div class="capsule-chamber-copy">
        <div class="foundation-kicker">Limited Dispenses Remaining</div>
        <div class="capsule-dispense-count">17</div>
      </div>
    </div>
    <div class="foundation-inventory-list">
      ${capsules.map((drop, idx) => `
        <div class="foundation-inventory-item capsule-drop ${drop.isFeatured ? 'is-featured' : ''}">
          <div class="foundation-item-head">
            <div>
              <div class="foundation-item-name">${drop.name}</div>
              <div class="foundation-item-sub">${drop.bias}</div>
            </div>
            ${renderRarityEventTag(drop.tag, 'cyan')}
          </div>
          <div class="foundation-signal">${drop.signal}</div>
          <div class="foundation-reward-list">
            ${drop.rewards.map(r => `<span>${r}</span>`).join('')}
          </div>
          <button class="foundation-action foundation-action--cyan" data-action="${drop.id}" data-price="${drop.price}">Dispense <span>$${drop.price.toFixed(2)}</span></button>
        </div>
      `).join('')}
    </div>
    ${renderCollectorNotice(
      FOUNDATION_OPERATIONAL_NOTICES.capsuleCorner.title,
      FOUNDATION_OPERATIONAL_NOTICES.capsuleCorner.body,
      FOUNDATION_OPERATIONAL_NOTICES.capsuleCorner.meta
    )}
  `;
  
  wrap.querySelectorAll('.foundation-action').forEach(btn => {
    const action = async () => {
      if (btn.disabled) return;
      const capsuleId = btn.dataset.action;
      const capsule = capsules.find(c => c.id === capsuleId);
      const price = parseFloat(btn.dataset.price);
      
      if (!isInfiniteBalance() && getBalance() < price) {
        const oldText = btn.innerHTML;
        btn.innerHTML = 'Insufficient';
        setTimeout(() => { btn.innerHTML = oldText; }, 1800);
        return;
      }
      
      haptic('medium');
      sfx.click();
      btn.disabled = true;
      btn.innerHTML = 'Dispensing...';
      
      const chamber = wrap.querySelector('.capsule-chamber');
      if (chamber) chamber.style.animation = 'capsuleSignalPulse 0.5s ease-in-out 3';
      
      await new Promise(r => setTimeout(r, 1500));
      
      const setIds = capsule.sets;
      const chosenSet = setIds[Math.floor(Math.random() * setIds.length)];
      vendor.activeCapsule = capsule;

      try {
        await runPackOpening(chosenSet, vendor, { skipSpend: false, favorBasis: price, price });
      } catch (err) {
        console.warn('[CapsuleCorner] Dispense failed:', err.message);
        showToast('Capsule dispense interrupted — connection recovered', 'warn');
      } finally {
        vendor.activeCapsule = null;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `Dispense <span>$${price.toFixed(2)}</span>`;
        }
      }
      };
      btn.onclick = action;
      iosTap(btn, action);  });
  return wrap;
}

function renderMuseumExchangeFoundation(vendor) {
  const wrap = document.createElement('div');
  wrap.className = 'foundation-vendor foundation-museum';
  
  const exhibition = getActiveExhibition();
  const rank = getCuratorRank();
  const rep = getCuratorReputation();

  wrap.innerHTML = `
    <div class="museum-exhibition-panel">
      <div class="foundation-kicker">Featured Exhibition</div>
      <div class="museum-exhibition-title">${exhibition.title}</div>
      <div class="museum-plaque-line"></div>
      <div class="museum-exhibition-copy">${exhibition.flavor}</div>
      ${renderRarityEventTag('Curator Stamp', 'gold')}
    </div>
    <div class="foundation-inventory-list museum-request-list">
      <div class="foundation-section-title">Curator Request</div>
      <div class="foundation-inventory-item museum-request">
        <div class="foundation-item-head">
          <div>
            <div class="foundation-item-name">${exhibition.requestText}</div>
            <div class="foundation-item-sub">Reward: ${exhibition.rewardRep} Rep · ${exhibition.rewardPrestige} Prestige</div>
          </div>
          <span class="museum-progress">${exhibition.progress} / ${exhibition.goal}</span>
        </div>
      </div>
    </div>
    <div class="museum-reputation-strip" style="margin: 10px 0; font-size: 13px; color: #aaa; text-align: center;">
      Curator Rank: <span style="color: #d6b25c;">${rank.name}</span> (${rep} pts)
    </div>
    <div class="foundation-action-row">
      <button class="foundation-action foundation-action--gold" data-action="Contribute" ${exhibition.progress >= exhibition.goal ? 'disabled' : ''}>${exhibition.progress >= exhibition.goal ? 'Completed' : 'Contribute'}</button>
      <button class="foundation-action foundation-action--gold" data-action="Archive" disabled>Archive</button>
      <button class="foundation-action foundation-action--gold" data-action="Transfer" disabled>Transfer</button>
    </div>
    ${renderCollectorNotice(
      FOUNDATION_OPERATIONAL_NOTICES.museumExchange.title,
      FOUNDATION_OPERATIONAL_NOTICES.museumExchange.body,
      FOUNDATION_OPERATIONAL_NOTICES.museumExchange.meta
    )}
  `;

  const contributeBtn = wrap.querySelector('.foundation-action[data-action="Contribute"]');
  if (contributeBtn && exhibition.progress < exhibition.goal) {
    const action = () => {
      haptic('soft');
      sfx.click();
      openMuseumContributionModal(exhibition);
    };
    contributeBtn.onclick = action;
    iosTap(contributeBtn, action);
  }

  return wrap;
}

function openMuseumContributionModal(exhibition) {
  let modal = document.getElementById('museum-contribution-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'museum-contribution-modal';
    modal.className = 'screen modal-backdrop hidden';
    document.body.appendChild(modal);
  }

  const eligibleCards = getEligibleMuseumCards(exhibition.criteria);
  
  let gridHtml = '';
  if (eligibleCards.length === 0) {
    gridHtml = '<p class="stats-empty">No eligible cards in your collection.</p>';
  } else {
    gridHtml = eligibleCards.map(item => {
      const cached = getCachedSetCards(item.setId) || [];
      const apiCard = cached.find(c => c.id === item.cardId) || { name: item.cardId, images: {} };
      const imgUrl = apiCard.images.small || apiCard.images.large || '';
      return `
        <div class="museum-contribute-card" data-set="${item.setId}" data-card="${item.cardId}">
          ${imgUrl ? `<img src="${imgUrl}" alt="${apiCard.name}" />` : '<div class="vault-thumb-placeholder">?</div>'}
          <div class="mcc-info">
            <div class="mcc-name">${apiCard.name}</div>
            <div class="mcc-qty">Available: ${item.available}</div>
          </div>
          <button class="mcc-btn">Archive</button>
        </div>
      `;
    }).join('');
  }

  modal.innerHTML = `
    <div class="sell-modal-content" style="max-height: 80vh; overflow-y: auto;">
      <div class="sell-header">
        <div class="sell-card-info">
          <div class="sell-card-name">${exhibition.title}</div>
          <div class="sell-card-rarity">Contribution</div>
        </div>
      </div>
      <div class="sell-warning">
        <div class="sell-warning-icon">⚠️</div>
        <div class="sell-warning-text">
          <div class="sell-warning-title">Permanent Archival</div>
          <div>Cards contributed to the museum are permanently removed from your collection.</div>
        </div>
      </div>
      <div class="museum-contribution-grid" style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
        ${gridHtml}
      </div>
      <div class="sell-actions" style="margin-top: 20px;">
        <button class="sell-cancel-btn" id="museum-cancel">Close</button>
      </div>
    </div>
  `;

  modal.querySelectorAll('.mcc-btn').forEach(btn => {
    btn.onclick = (e) => {
      const cardEl = e.target.closest('.museum-contribute-card');
      const setId = cardEl.dataset.set;
      const cardId = cardEl.dataset.card;
      
      if (contributeToMuseum(setId, cardId)) {
        haptic('heavy');
        sfx.purchase();
        showToast('Card permanently archived.', 'rep');
        hideScreen(modal);
        unlockBodyScroll();
        renderVendorHub(); // refresh exhibition progress
      }
    };
  });

  modal.querySelector('#museum-cancel').onclick = () => {
    hideScreen(modal);
    unlockBodyScroll();
  };

  showScreen(modal);
  lockBodyScroll();
}

function getAuctionPreviewCard() {
  const preferredSets = ['sv3pt5', 'sv4pt5', 'swsh7', 'swsh11', 'sv2'];
  for (const setId of preferredSets) {
    const cards = getCachedSetCards(setId) || [];
    const found = cards.find(c => /charizard/i.test(c.name || '') && c.images)
      || cards.find(c => /special illustration|hyper rare|ultra rare/i.test(c.rarity || '') && c.images)
      || cards.find(c => c.images);
    if (found) return { setId, apiCard: found };
  }
  return {
    setId: 'sv3pt5',
    apiCard: {
      id: 'estate-preview-charizard',
      name: 'Charizard ex',
      rarity: 'Special Illustration Rare',
      set: { name: 'Estate Archive' },
      number: '7A-19',
      images: {},
    },
  };
}

function buildAuctionPreviewSlab(lot) {
  const now = Date.now();
  return {
    uid: `estate-${lot.lot}`,
    setId: 'sv3pt5',
    cardId: 'estate-preview-charizard',
    serial: 'AGS-EST-7A19',
    tier: 'prestige',
    submittedAt: now - 5 * 24 * 60 * 60 * 1000,
    gradedAt: now - 2 * 24 * 60 * 60 * 1000,
    prestigeSlab: true,
    grade: {
      numeric: 10,
      label: 'AGS 10',
      name: 'Archive Pristine',
      average: 99.1,
      multiplier: 4.2,
      tier: { id: 'AGS_10' },
      subgrades: { centering: 99, surface: 98, edges: 100, corners: 99, printQuality: 99 },
    },
  };
}

function renderEstateAuctionsFoundation(vendor) {
  const lot = ESTATE_AUCTION_LOTS[0];
  const preview = getAuctionPreviewCard();
  const slab = buildAuctionPreviewSlab(lot);
  slab.setId = preview.setId;
  slab.cardId = preview.apiCard.id;
  const imgUrl = preview.apiCard.images?.small || preview.apiCard.images?.large || '';

  const wrap = document.createElement('div');
  wrap.className = 'foundation-vendor foundation-estate';
  wrap.innerHTML = `
    <div class="foundation-status-row">
      ${renderRarityEventTag('Private bidding activity detected.', 'crimson')}
      ${renderCountdownPill('Ends In', lot.ends)}
    </div>
    <div class="estate-lot-card">
      <button class="estate-card-preview" type="button" aria-label="Inspect auction slab">
        <span class="estate-card-preview__glow" aria-hidden="true"></span>
        ${imgUrl
          ? `<img class="estate-card-preview__img" src="${imgUrl}" alt="${preview.apiCard.name}" loading="lazy" />`
          : `<span class="estate-card-preview__fallback">${preview.apiCard.name}</span>`
        }
        <span class="estate-card-preview__ags">AGS</span>
        <span class="estate-card-preview__grade">10</span>
      </button>
      <div class="estate-lot-copy">
        <div class="foundation-kicker">${lot.lot}</div>
        <div class="estate-lot-title">${lot.title}</div>
        <div class="estate-lot-name">${lot.cardName} <span>AGS 10</span></div>
        <div class="estate-lot-rarity">${lot.rarity}</div>
        <div class="estate-lot-estimate"><span>Est. Value</span>${lot.estimate}</div>
        <div class="estate-interest-meter" aria-label="Collector interest extreme">
          <div class="estate-interest-meter__label"><span>Collector Interest</span><strong>Extreme</strong></div>
          <div class="estate-interest-meter__track"><span style="width:88%"></span></div>
        </div>
        ${renderCollectorNotice('Estate Notice', lot.note, 'Elite collector interest elevated.')}
      </div>
    </div>
    <div class="foundation-action-row">
      <button class="foundation-action foundation-action--estate" data-action="Enter Bid">Enter Bid</button>
      <button class="foundation-action foundation-action--estate" data-action="Observe">Observe</button>
      <button class="foundation-action foundation-action--estate" data-action="Track Lot">Track Lot</button>
    </div>
    ${renderCollectorNotice(
      FOUNDATION_OPERATIONAL_NOTICES.estateAuctions.title,
      FOUNDATION_OPERATIONAL_NOTICES.estateAuctions.body,
      FOUNDATION_OPERATIONAL_NOTICES.estateAuctions.meta
    )}
  `;
  const previewBtn = wrap.querySelector('.estate-card-preview');
  const openPreview = () => openEstateAuctionLightbox(lot, slab, preview.apiCard);
  if (previewBtn) {
    previewBtn.onclick = openPreview;
    iosTap(previewBtn, openPreview);
  }
  wrap.querySelectorAll('.foundation-action').forEach(btn => {
    attachFoundationButton(btn, vendor, btn.dataset.action || 'Observe');
  });
  return wrap;
}

function openEstateAuctionLightbox(lot, slab, apiCard) {
  const existing = document.querySelector('.estate-lightbox');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'estate-lightbox';
  overlay.innerHTML = `
    <div class="estate-lightbox__backdrop"></div>
    <div class="estate-lightbox__stage" role="dialog" aria-modal="true" aria-label="Estate auction lot">
      <button class="estate-lightbox__close" type="button" aria-label="Close">×</button>
      <div class="estate-lightbox__header">
        <div>
          <div class="foundation-kicker">${lot.lot}</div>
          <div class="estate-lightbox__title">${lot.title}</div>
        </div>
        ${renderCountdownPill('Ends In', lot.ends)}
      </div>
      <div class="estate-lightbox__slab"></div>
      <div class="estate-lightbox__details">
        <div class="estate-lightbox__detail">
          <span>Card</span>
          <strong>${lot.cardName}</strong>
        </div>
        <div class="estate-lightbox__detail">
          <span>Certification</span>
          <strong>${slab.serial}</strong>
        </div>
        <div class="estate-lightbox__detail">
          <span>Grade</span>
          <strong>${slab.grade.label} · ${slab.grade.name}</strong>
        </div>
        <div class="estate-lightbox__detail">
          <span>Estimate</span>
          <strong>${lot.estimate}</strong>
        </div>
      </div>
      ${renderCollectorNotice('Auction House Note', 'Private bidding activity remains active around this archival lot.', 'Estate access remains limited during rollout')}
    </div>
  `;

  overlay.querySelector('.estate-lightbox__slab')?.appendChild(renderPremiumSlab(slab, apiCard));
  document.body.appendChild(overlay);
  lockBodyScroll();

  let disposeEsc = null;
  const close = () => {
    disposeEsc?.();
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.remove();
      unlockBodyScroll();
    }, 180);
  };
  overlay.querySelector('.estate-lightbox__close')?.addEventListener('click', close);
  overlay.querySelector('.estate-lightbox__backdrop')?.addEventListener('click', close);
  disposeEsc = onEscapeKey(close);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}

function renderVendorPackTile(item, vendor) {
  const pack    = PACK_STORE[item.setId];
  if (!pack) return document.createElement('div');
  // v1.4.0 — apply temp milestone discount + active vendor world event discount
  // on top of the existing vendor base price (additive, capped at 50%).
  let basePrice = getEffectivePackPrice(vendor.id, item.price);
  const tempPct  = getTempVendorDiscount(vendor.id);
  const eventPct = (getVendorEventEffect(vendor.id).packDiscountPct) || 0;
  const totalPct = Math.min(0.5, tempPct + eventPct);
  const finalPrice = basePrice * (1 - totalPct);
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
  // v1.2.2c — Root-cause rebuild.
  // The tile is split into TWO COMPLETELY SEPARATE SIBLING elements:
  //   .broker-chase-preview  → navigation only (art + name + rarity + price)
  //   button                 → purchase only
  //
  // Previously the button was nested INSIDE the tile's clickable region, causing
  // iOS Safari tap ambiguity. iosTap also calls handler() with zero args, so any
  // handler that checked (e) => { if (e.target...) } was crashing silently on
  // every mobile touch. The new structure needs no guards, no stopPropagation.

  const tile = document.createElement('div');
  tile.className = 'broker-chase-tile';

  const cached  = getCachedSetCards(pick.setId) || [];
  const apiCard = cached.find(c => c.id === pick.cardId);

  // ── Preview region: art + metadata, navigation handler only ────────────────
  const preview = document.createElement('div');
  preview.className = 'broker-chase-preview';
  preview.innerHTML =
    `<img src="${pick.imageUrl}" class="broker-chase-img" alt="${pick.name}" />` +
    `<div class="broker-chase-name">${pick.name}</div>` +
    `<div class="broker-chase-tier">${RARITY_LABELS[pick.tier] || pick.tier}</div>` +
    `<div class="broker-chase-price">$${pick.price.toLocaleString()}</div>`;

  const doInspect = () => {
    if (!apiCard) return;
    openBinderScreen(pick.setId, pick.cardId);
  };
  preview.onclick = doInspect;
  iosTap(preview, doInspect);

  // ── Acquire button: purchase handler only, sibling NOT child of preview ─────
  const btn = document.createElement('button');
  btn.className = 'vendor-buy-btn vendor-buy-btn--lux broker-acquire-btn';
  btn.textContent = 'Acquire';

  const doPurchase = () => {
    buyChaseCard(
      apiCard || { id: pick.cardId, name: pick.name, images: { small: pick.imageUrl } },
      pick.setId, pick.price, vendor, btn
    );
  };
  btn.onclick = doPurchase;
  iosTap(btn, doPurchase);

  tile.appendChild(preview);
  tile.appendChild(btn);
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

  // v1.2.2e — lock background scroll for the full pack-opening sequence.
  // Prevents Safari rubber-band / scroll-bleed behind the overlay.
  // Balanced in finally so load/reveal errors cannot strand iOS scroll.
  lockBodyScroll();

  let newCards = [];
  try {
    const animationDone = openPackInteraction(setId);
    let dataReady = false;
    const loadDone = (async () => {
      if (getCurrentSetId() !== setId) await loadSet(setId);
      setCurrentSet(setId); dataReady = true; hidePackLoadingIndicator();
    })();
    await animationDone;
    if (!dataReady) { showPackLoadingIndicator(); await loadDone; }

    engine.stepSimulation();
    newCards = augmentCards(engine.state.cards.slice(-10), setId, vendor);
    await openPackOverlay(newCards, engine.state.packsOpened);
  } finally {
    unlockBodyScroll();
  }

  const newDiscoveries = newCards.filter(c => !getOwnedEntry(setId, c.id)).length;
  newCards.forEach(addCard);

  // v1.5.0 — combined collection-add + per-copy quality generation. Each
  // physical copy carries its own hidden quality fingerprint, so we must
  // capture the copy number AT THE MOMENT OF ADD (not after all adds, which
  // would lose the per-copy ordering for cards pulled multiple times).
  newCards.forEach(c => {
    addCardToCollection(c);
    const tier = c.rarityType || c.rarity;
    if (!isEligibleRarity(tier)) return;
    try {
      const copyN = getOwnedEntry(setId, c.id)?.count || 1;
      ensureQualityForCopy(setId, c.id, copyN, tier, { sourceVendor: vendor });
    } catch (err) { console.error('[quality] per-copy generation failed', err); }
  });
  incrementPacksOpened();

  // v1.4.0 — Prestige pull detection + atmospheric treatment + archive log.
  // Eligibility: illustration/special/hyper OR wishlist hit OR daily-chase pull.
  const prestigeHits = newCards.filter(c => {
    const tier = c.rarityType || c.rarity;
    return PRESTIGE_PULL_TIERS.has(tier) || isWishlisted(c.id) || isChaseCard(c.id);
  });
  const wishlistHits = newCards.filter(c => isWishlisted(c.id));

  if (prestigeHits.length > 0) {
    const top = prestigeHits[0];
    showPrestigePullOverlay(top);
    addPrestigeBonus(8 * prestigeHits.length, 'prestige_pull');
    logActivity('prestige_pull', `${vendor.name} · pulled ${top.name}`);
    haptic('heavy');
  }
  if (wishlistHits.length > 0) {
    const wh = wishlistHits[0];
    addPrestigeBonus(12 * wishlistHits.length, 'wishlist_hit');
    logActivity('wishlist_hit', `Wishlist hit · ${wh.name}`);
    showToast(`Wishlist hit · ${wh.name}`, 'rep');
    recordArchiveEvent('wishlist_hit',
      `Wishlist hit · pulled ${wh.name}`,
      { meta: { setId, cardId: wh.id } });
  }

  // First-of-a-kind archive entries (deduped by key)
  newCards.forEach(c => {
    const tier = c.rarityType || c.rarity;
    if (tier === 'illustrationRare')      maybeFirstArchive('first_illustration_rare', `First Illustration Rare · ${c.name}`);
    if (tier === 'specialIllustrationRare')maybeFirstArchive('first_special_illustration', `First Special Illustration Rare · ${c.name}`);
    if (tier === 'hyperRare')             maybeFirstArchive('first_hyper_rare', `First Hyper Rare · ${c.name}`);
  });

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

  // v1.2.1 — log pack activity for the World Activity feed
  if (!skipSpend) {
    const hit = newCards.find(c => RARITY_ORDER.indexOf(c.rarityType || c.rarity) >= 2);
    logActivity('pack_opened', hit ? `${vendor.name} · pulled ${hit.name}` : `${vendor.name} · pack opened`);
  }

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
    // v1.4.0 — archive a set completion milestone once per set
    const setName = PACK_STORE[setId]?.name || setId;
    recordArchiveEvent('set_completed',
      `Set completed · ${setName}`,
      { key: `set_complete:${setId}`, meta: { setId } });
  }

  // Phase 10.4 — milestone sweep after collection grew
  sweepMilestones();

  // v1.4.0 — value history snapshot (one per day, lifetime peak tracked).
  try { recordCollectionValueSnapshot(); }
  catch (err) { console.error('[value-history] snapshot failed', err); }

  if (!skipSpend) {
    renderVendorHub();
    updateRankStrip();
  }
}

// ─── Phase 10.4 — Collector Requests UI + completion ─────────────────────────

function renderRequestsPanel(vendor, requests, emergencyReq = null) {
  const panel = document.createElement('div');
  panel.className = 'vendor-requests';
  const refreshLabel = getRequestRefreshLabel(vendor.id);

  panel.innerHTML = `
    <div class="vendor-requests-head">
      <span class="vendor-requests-title">Collector Requests</span>
      <span class="vendor-requests-rotate">${refreshLabel}</span>
    </div>
    <div class="vendor-requests-list"></div>
  `;
  const list = panel.querySelector('.vendor-requests-list');

  // v1.3.0a — Emergency Request renders first, visually distinct.
  if (emergencyReq) {
    const prog       = getRequestProgress(emergencyReq);
    const fulfilled  = prog.completed;
    const required   = emergencyReq.quantity ?? prog.total ?? 1;
    const canDo      = fulfilled >= required;
    const tag        = emergencyReq.volatileTag;
    const card = document.createElement('div');
    card.className = `vendor-request vendor-request--emergency ${canDo ? 'is-ready' : ''} ${emergencyReq.isPrestige ? 'is-prestige' : ''}`;
    card.innerHTML = `
      <div class="vendor-request-row">
        <span class="vendor-request-flavor">${emergencyReq.flavorLabel}</span>
        <span class="vendor-request-tag tag-emergency">Emergency</span>
        ${tag ? `<span class="vendor-request-tag tag-volatile">${tag}</span>` : ''}
        ${emergencyReq.isPrestige ? '<span class="vendor-request-tag tag-prestige">Prestige</span>' : ''}
      </div>
      <div class="vendor-request-title">${emergencyReq.title}</div>
      ${emergencyReq.note ? `<div class="vendor-request-note">${emergencyReq.note}</div>` : ''}
      <div class="vendor-request-meta">
        <span class="vendor-request-reward">$${emergencyReq.reward}</span>
        <span class="vendor-request-favor">+${emergencyReq.favorReward} favor</span>
        <span class="vendor-request-rotate">${getEmergencyRotationLabel(vendor.id)}</span>
      </div>
      <div class="vendor-request-foot">
        <span class="vendor-request-progress">${fulfilled} / ${required} ready</span>
        <button class="vendor-request-btn" ${canDo ? '' : 'disabled'}>
          ${canDo ? 'Fulfill' : 'Need duplicates'}
        </button>
      </div>
    `;
    const btn = card.querySelector('.vendor-request-btn');
    if (btn && canDo) {
      const doFill = () => fulfillRequest(emergencyReq.id, vendor, btn);
      btn.onclick = doFill;
      iosTap(btn, doFill);
    }
    list.appendChild(card);
  }

  requests.forEach(req => {
    const prog       = getRequestProgress(req);
    const fulfilled  = prog.completed;
    const required   = req.quantity ?? prog.total ?? 1;
    const canDo      = fulfilled >= required;
    const demandPct  = Math.round(req.demandModifier * 100);
    const demandSign = demandPct > 0 ? '+' : '';
    const isHot      = req.demandModifier >= 0.30;
    const isCold     = req.demandModifier <= -0.05;

    const card = document.createElement('div');
    card.className = `vendor-request ${canDo ? 'is-ready' : ''} ${isHot ? 'is-hot' : ''} ${isCold ? 'is-cold' : ''}`;
    card.innerHTML = `
      <div class="vendor-request-row">
        <span class="vendor-request-flavor">${req.flavorLabel}</span>
        ${isHot ? '<span class="vendor-request-tag tag-hot">High Demand</span>' : ''}
        ${isCold ? '<span class="vendor-request-tag tag-cold">Soft Demand</span>' : ''}
      </div>
      <div class="vendor-request-title">${req.title}</div>
      <div class="vendor-request-meta">
        <span class="vendor-request-reward">$${req.reward}</span>
        <span class="vendor-request-favor">+${req.favorReward} favor</span>
        <span class="vendor-request-demand">${demandSign}${demandPct}% demand</span>
      </div>
      <div class="vendor-request-foot">
        <span class="vendor-request-progress">${fulfilled} / ${required} ready</span>
        <button class="vendor-request-btn" ${canDo ? '' : 'disabled'}>
          ${canDo ? 'Fulfill' : 'Need duplicates'}
        </button>
      </div>
    `;
    const btn = card.querySelector('.vendor-request-btn');
    if (btn && canDo) {
      btn.onclick = () => fulfillRequest(req.id, vendor, btn);
    }
    list.appendChild(card);
  });

  return panel;
}

function fulfillRequest(requestId, vendor, btn) {
  // Re-validate atomically — collection may have changed since render
  if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }

  const result = fulfillVendorRequest(requestId);
  if (!result.ok) {
    if (btn) {
      btn.textContent = result.reason === 'insufficient' ? 'Not enough'
        : result.reason === 'write-failed' ? 'Save failed'
        : 'Unavailable';
      setTimeout(() => renderVendorHub(), 1200);
    }
    return;
  }

  haptic('medium');
  sfx.purchase();
  checkDistressTransition();
  updateBalanceUI();
  showToast(`Request fulfilled · +$${result.reward} · ${vendor.name} Favor +${result.favorReward}`, 'sell');
  logActivity('request_fulfilled', `${vendor.name} · request +$${result.reward}`);

  sweepMilestones();

  renderVendorHub();
  updateRankStrip();
}

// ─── Phase 10.4 — Milestone sweep + celebratory toast ────────────────────────

function sweepMilestones() {
  try {
    const claimed = getReadyMilestoneRewards();
    if (claimed.length === 0) return;
    withLocalStorageRollback([
      'tcg_milestones',
      'tcg_player_v2',
      'tcg_reputation',
      'tcg_favor',
      'tcg_prestige_bonus',
      'tcg_archive_history',
    ], () => {
      let totalCash = 0;
      let totalRep  = 0;
      for (const m of claimed) {
        totalCash += m.rewardCash || 0;
        totalRep  += m.rewardRep  || 0;
      }
      if (totalCash > 0) { addBalance(totalCash); checkDistressTransition(); }
      if (totalRep  > 0) addReputation(totalRep);

      // v1.4.0 — diversified rewards: process favor / prestige / discount / archive
      for (const m of claimed) {
        if (m.rewardFavor && m.rewardFavor.vendorId && m.rewardFavor.amount) {
          addFavor(m.rewardFavor.vendorId, m.rewardFavor.amount);
        }
        if (m.rewardPrestige) {
          addPrestigeBonus(m.rewardPrestige, `milestone:${m.id}`);
        }
        if (m.rewardDiscount && m.rewardDiscount.vendorId && m.rewardDiscount.pct) {
          const dur = m.rewardDiscount.durationMs || 6 * 60 * 60 * 1000;
          applyTempVendorDiscount(m.rewardDiscount.vendorId, m.rewardDiscount.pct, dur);
        }
        if (m.rewardArchive) {
          recordArchiveEvent('milestone_major', m.rewardArchive,
            { key: `milestone:${m.id}` });
        }
      }
      markMilestonesClaimed(claimed.map(m => m.id));
    });

    updateBalanceUI();
    claimed.forEach((m, i) => {
      setTimeout(() => {
        const parts = [];
        if (m.rewardCash) parts.push(`+$${m.rewardCash}`);
        if (m.rewardRep)  parts.push(`+${m.rewardRep} rep`);
        if (m.rewardFavor && m.rewardFavor.amount) {
          const vname = VENDOR_DISPLAY[m.rewardFavor.vendorId] || m.rewardFavor.vendorId;
          parts.push(`+${m.rewardFavor.amount} ${vname} favor`);
        }
        if (m.rewardPrestige) parts.push(`+${m.rewardPrestige} prestige`);
        if (m.rewardDiscount) {
          const vname = VENDOR_DISPLAY[m.rewardDiscount.vendorId] || m.rewardDiscount.vendorId;
          parts.push(`${vname} -${Math.round(m.rewardDiscount.pct * 100)}% (temp)`);
        }
        if (m.rewardNote) parts.push(m.rewardNote);
        const suffix = parts.length ? ` · ${parts.join(' · ')}` : '';
        showToast(`Milestone: ${m.title}${suffix}`, 'rep');
        haptic('medium');
        logActivity('milestone', `Milestone · ${m.title}`);
      }, 300 + i * 700);
    });
  } catch (err) {
    console.error('[milestones] sweep failed', err);
    try { loadPlayerState(); updateBalanceUI(); } catch {}
  }
}

// ─── v1.4.0 — Prestige Pull overlay + archive helpers ────────────────────────

/**
 * Subtle, restrained "prestige pull" overlay shown briefly after a major hit.
 * Lives over the existing pack overlay window with a soft darkening + a
 * single line of atmospheric collector text. Auto-dismisses after ~2s.
 *
 * Reduced-motion users get a fade-only variant.
 */
function showPrestigePullOverlay(card) {
  try {
    const wrap = document.createElement('div');
    wrap.className = 'prestige-pull-overlay';
    const line = PRESTIGE_PULL_LINES[Date.now() % PRESTIGE_PULL_LINES.length];
    wrap.innerHTML = `
      <div class="prestige-pull-frame">
        <div class="prestige-pull-eyebrow">Notable Acquisition</div>
        <div class="prestige-pull-card-name">${card?.name || 'Card'}</div>
        <div class="prestige-pull-line">${line}</div>
      </div>
    `;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-visible'));
    setTimeout(() => {
      wrap.classList.remove('is-visible');
      setTimeout(() => wrap.remove(), 320);
    }, 2000);
  } catch (err) {
    console.error('[prestige-pull] overlay failed', err);
  }
}

/** Record an archive entry only if the dedup key hasn't been logged. */
function maybeFirstArchive(key, label) {
  try {
    if (hasArchiveKey(key)) return;
    recordArchiveEvent('prestige_pull', label, { key });
  } catch (err) {
    console.error('[archive] first-of-a-kind failed', err);
  }
}

/**
 * Compute the player's current collection value and persist a daily
 * snapshot. Called from runPackOpening, buyChaseCard, and post-sell.
 * Lifetime-peak transitions are recorded as archive events.
 */
function recordCollectionValueSnapshot() {
  const summary = recordChronologicalCollectionSnapshot();
  // Lifetime peak — archive once per peak (key includes rounded value to dedupe)
  if (summary.today === summary.peak && summary.today > 0) {
    const key = `value_peak:${Math.floor(summary.peak / 50) * 50}`;
    try { recordArchiveEvent('value_peak', `New collection-value peak · $${summary.peak.toFixed(2)}`, { key }); } catch {}
  }
  return summary;
}

async function buyChaseCard(apiCard, setId, price, vendor, btn) {
  if (!spendBalance(price)) {
    btn.textContent = 'Insufficient Funds';
    setTimeout(() => { btn.textContent = 'Acquire'; }, 2000);
    return;
  }
  // v1.2.0 — track broker purchase + distress transition after spending
  incrementBrokerPurchases();
  checkDistressTransition();
  updateBalanceUI();
  btn.disabled = true;
  btn.textContent = 'Acquired ✓';

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
  logActivity('broker_purchase', `Broker · acquired ${apiCard.name}`);

  // v1.4.0 — broker chase acquisition is a prestige moment.
  // Archive once per card; grant a small prestige bonus; snapshot value.
  try {
    if (apiCard?.id) {
      recordArchiveEvent('broker_acquisition',
        `Broker acquisition · ${apiCard.name || 'chase card'} · $${Number(price).toFixed(0)}`,
        { key: `broker_buy:${setId}:${apiCard.id}` });
      addPrestigeBonus(15, 'broker_acquisition');
      recordCollectionValueSnapshot();
    }
  } catch (err) {
    console.error('[broker] v1.4.0 archive/prestige hook failed', err);
  }

  updateRankStrip();
  renderRecentHits();
  setTimeout(() => renderVendorHub(), 600);
}

function updateBalanceUI() {
  const el = document.getElementById('balance-display');
  if (el) el.textContent = '$' + getBalance().toFixed(2);
}

// v1.2.1 — human-readable relative timestamp for the activity feed
function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Phase 10.1.7 — iOS touch-bypass utility ─────────────────────────────────
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
// v1.6.0 — Wishlist + Favorites buttons removed from header. Both are now
// reachable through the .collection-filters pill row (wired in
// renderCollectionScreen below). Guards left in place so legacy DOM with the
// old buttons still wires up cleanly.
const _wlLegacyBtn = document.getElementById('wishlist-btn');
if (_wlLegacyBtn) {
  _wlLegacyBtn.onclick = openWishlistScreen;
  iosTap(_wlLegacyBtn, openWishlistScreen);
}
const _openFavoritesScreen = () => openFavoritesScreen({
  openCardDetail: (setId, cardId) => {
    const cached = getCachedSetCards(setId) || [];
    const apiCard = cached.find(c => c.id === cardId);
    if (!apiCard) return;
    const ownedEntry = getCollection()[setId]?.[cardId] ?? null;
    openCardDetail(apiCard, ownedEntry, setId);
  },
});
const _favLegacyBtn = document.getElementById('favorites-btn');
if (_favLegacyBtn) {
  _favLegacyBtn.onclick = _openFavoritesScreen;
  iosTap(_favLegacyBtn, _openFavoritesScreen);
}
document.addEventListener('favorites-screen-closed', () => unlockBodyScroll());

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

  // v1.6.0 — Filter pills (All · Favorites · Wishlist · Archived) below title.
  renderCollectionFilters();

  // v1.5.1 — AGS entry panel above the binder list.
  renderCollectionAgsEntry();

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
      ${artUrl ? `<img src="${artUrl}" class="set-card-art" alt="${packInfo.name}" loading="lazy" />` : ''}
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

// v1.5.1 — Compute lightweight AGS summary for entry panels (Collection + Stats).
// Eligible = owned copies of Double Rare+ rarity that aren't currently locked
// inside an active AGS submission. Tolerates any missing pieces.
function computeAgsEntrySummary() {
  let eligible = 0, archived = 0, highest = '—';
  try {
    const stats = getAgsStats();
    archived = stats.archived ?? 0;
    if (stats.highestSlab?.grade?.tier?.label) {
      highest = stats.highestSlab.grade.tier.label;
    } else if (stats.highestSlab?.grade?.label) {
      highest = stats.highestSlab.grade.label;
    }
  } catch {}
  try {
    const collection = getCollection();
    for (const [setId, cards] of Object.entries(collection)) {
      const cached = getCachedSetCards(setId) || [];
      const byId = Object.fromEntries(cached.map(c => [c.id, c]));
      for (const [cardId, entry] of Object.entries(cards)) {
        const apiCard = byId[cardId];
        if (!apiCard) continue;
        const tier = mapPokemonRarity(apiCard.rarity);
        if (!isEligibleRarity(tier)) continue;
        const locked = Number(lockedCopiesFor(setId, cardId)) || 0;
        eligible += Math.max(0, (entry.count || 0) - locked);
      }
    }
  } catch {}
  return { eligible, archived, highest };
}

// v1.6.0 — Collection filter pills.
//   All       — re-renders set list (default)
//   Favorites — opens dedicated Favorites showcase screen
//   Wishlist  — opens existing wishlist screen
//   Archived  — opens AGS screen on Registry tab
// Pills aren't a stateful "filter" of the set list — they're navigation pivots
// that stay highlighted to ALL while the user is on the Collection screen.
function renderCollectionFilters() {
  const host = document.getElementById('collection-filters');
  if (!host) return;
  host.innerHTML = `
    <button class="rb-pill collection-filter-pill is-active" data-filter="all"       type="button">All</button>
    <button class="rb-pill collection-filter-pill"           data-filter="favorites" type="button">★ Favorites</button>
    <button class="rb-pill collection-filter-pill"           data-filter="wishlist"  type="button">☆ Wishlist</button>
    <button class="rb-pill collection-filter-pill"           data-filter="archived"  type="button">⬢ Archived</button>
  `;
  host.querySelectorAll('.collection-filter-pill').forEach(pill => {
    const f = pill.getAttribute('data-filter');
    const handler = () => {
      haptic('soft');
      if (f === 'favorites')      { _openFavoritesScreen(); return; }
      if (f === 'wishlist')       { openWishlistScreen();   return; }
      if (f === 'archived')       { setAgsActiveTab('registry'); openAgsScreen(); return; }
      // 'all' is a no-op pivot — user is already on the Collection screen
    };
    pill.addEventListener('click', handler);
    iosTap(pill, handler);
  });
}

// v1.5.1 — Collection page AGS entry panel.
// Premium charcoal-and-gold panel placed above the set list. Tapping the
// panel or its CTA opens the Archive Services screen.
function renderCollectionAgsEntry() {
  const host = document.getElementById('collection-ags-entry');
  if (!host) return;

  const summary = computeAgsEntrySummary();
  const { eligible, archived, highest } = summary;

  host.innerHTML = `
    <div class="ags-entry-panel" id="ags-entry-panel" role="button" tabindex="0"
         aria-label="Open Archive Grading Services">
      <div class="ags-entry-panel__sweep" aria-hidden="true"></div>
      <div class="ags-entry-panel__top">
        <div class="ags-entry-panel__brand">
          <div class="ags-entry-panel__mark">AGS</div>
          <div class="ags-entry-panel__brand-text">
            <div class="ags-entry-panel__title">Archive Grading Services</div>
            <div class="ags-entry-panel__tagline">Preservation · Authentication · Prestige</div>
          </div>
        </div>
        <div class="ags-entry-panel__stats">
          <div class="ags-entry-panel__stat">
            <div class="ags-entry-panel__stat-num">${eligible}</div>
            <div class="ags-entry-panel__stat-label">Eligible</div>
          </div>
          <div class="ags-entry-panel__stat">
            <div class="ags-entry-panel__stat-num">${archived}</div>
            <div class="ags-entry-panel__stat-label">Archived</div>
          </div>
          <div class="ags-entry-panel__stat">
            <div class="ags-entry-panel__stat-num">${highest}</div>
            <div class="ags-entry-panel__stat-label">Top Grade</div>
          </div>
        </div>
      </div>
      <button class="ags-entry-panel__cta" id="ags-entry-cta" type="button">
        Enter Archive Services
      </button>
    </div>
  `;

  const panel = host.querySelector('#ags-entry-panel');
  const cta   = host.querySelector('#ags-entry-cta');
  const open  = (e) => {
    e?.stopPropagation?.();
    haptic('soft');
    openAgsScreen();
  };
  panel.addEventListener('click', open);
  iosTap(panel, () => openAgsScreen());
  cta.addEventListener('click', open);
  iosTap(cta, () => openAgsScreen());
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAgsScreen(); }
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

  // v1.2.2d/e — save scroll position and record whether collection was already
  // visible so closeBinderScreen can balance the lock count correctly.
  const _collEl = document.getElementById('collection-screen');
  _binderCameFromCollection = !!_collEl && !_collEl.classList.contains('hidden');
  if (_collEl) _collectionScrollTop = _collEl.scrollTop;

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
  // v1.2.2d — Root-cause fix for blank collection on return.
  // When the binder is opened from the Broker (not from openCollectionScreen),
  // collection-screen was never rendered — #set-list is empty.
  // Always re-render before showing: it's a pure localStorage read + DOM
  // rebuild so it's fast and safe regardless of how the binder was entered.
  hideScreen(document.getElementById('binder-screen'));
  const collScreen = document.getElementById('collection-screen');
  try { renderCollectionScreen(); } catch (err) {
    console.error('[Nav] closeBinderScreen — renderCollectionScreen threw:', err);
  }
  // v1.2.2e — reference-count balance:
  // openBinderScreen() always adds one lock (+1). Two cases:
  //   a) Came from collection (depth was ≥1): remove binder's extra lock so
  //      collection's own lock remains at depth=1.
  //   b) Came from Hub/Broker (depth was 0, only binder's lock): repurpose
  //      that lock as collection's lock — no call needed.
  if (_binderCameFromCollection) unlockBodyScroll();
  showScreen(collScreen);
  // Restore the scroll position saved when the binder was opened
  if (_collectionScrollTop > 0) {
    requestAnimationFrame(() => { collScreen.scrollTop = _collectionScrollTop; });
  }
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
        badge.textContent = 'DP ×' + ownedEntry.count;
        slot.appendChild(badge);
      }

      // Lock icon for first/last copies that are still locked
      if (ownedEntry.count === 1 && (ownedEntry.locked !== false)) {
        const lock = document.createElement('div');
        lock.className   = 'lock-corner';
        lock.textContent = '🔒';
        slot.appendChild(lock);
      }

      // v1.2.1 — reverse holo variant indicator
      if (ownedEntry.reverseHolo > 0) {
        const rhBadge = document.createElement('div');
        rhBadge.className   = 'rh-badge';
        rhBadge.textContent = 'RH';
        slot.appendChild(rhBadge);
      }

      // v1.6.0 — graded badge + acrylic-edge effect when a slab exists for
      // this card. Tier class drives the color of both the medallion and the
      // ::before slab-edge inset (defined in style.css).
      const _topSlab = getHighestSlabForCard(_binderSetId, apiCard.id);
      if (_topSlab) {
        const tierClass = (_topSlab.grade?.tier?.id || 'na').toLowerCase().replace(/_/g, '-');
        slot.classList.add('has-archived', `archived-tier-${tierClass}`);
        const medallion = document.createElement('div');
        medallion.className   = `binder-grade-badge binder-grade-badge--${tierClass}`;
        medallion.textContent = _topSlab.grade?.tier?.label || 'AGS';
        medallion.title       = `Archived · ${_topSlab.grade?.label || ''}`;
        slot.appendChild(medallion);
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
        // v1.2.2 — scroll card into view then pulse-highlight it
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        target.classList.add('slot-highlight');
        setTimeout(() => target.classList.remove('slot-highlight'), 1600);
      }
    }, 80);
  }
}

// ─── Evolution chain ──────────────────────────────────────────────────────────

const _evolutionMapCache = new Map();

function buildEvolutionChain(apiCard, setId) {
  const setCards = getCachedSetCards(setId) || [];

  // ⚡ Bolt: Memoize the Pokemon map per set to avoid O(N) map creation on every call
  let pokémonMap = _evolutionMapCache.get(setId);
  if (!pokémonMap) {
    pokémonMap = new Map();
    for (let i = 0; i < setCards.length; i++) {
      if (setCards[i].supertype === 'Pokémon') {
        pokémonMap.set(setCards[i].name, setCards[i]);
      }
    }
    _evolutionMapCache.set(setId, pokémonMap);
  }

  const byName   = (n) => pokémonMap.get(n);
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

function buildCardDetailHTML(apiCard, ownedEntry, resolvedSetId, value, rarityTier) {
  const isOwned    = ownedEntry !== null;
  const pullRate   = PULL_RATES[rarityTier]    || '~1 in 1 pack';
  const rarityLbl  = RARITY_LABELS[rarityTier] || apiCard.rarity;
  const wishlisted = isWishlisted(apiCard.id);
  const favorited  = isFavorited(apiCard.id);

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
  const rhCount       = isOwned ? (ownedEntry.reverseHolo || 0) : 0;
  const rhLine        = rhCount > 0 ? `<div class="cdp-rh-owned">Reverse Holo ×${rhCount}</div>` : '';
  const previewNotice = !isOwned ? `<div class="cdp-not-owned">Not in your collection yet</div>` : '';

  let archiveSectionHTML = '';
  let archiveTopSlab = null;
  if (resolvedSetId) {
    const _slabsForCard = getSlabsForCard(resolvedSetId, apiCard.id);
    if (_slabsForCard.length > 0) {
      archiveTopSlab = _slabsForCard.reduce((best, s) =>
        (s.grade?.tier?.rank || 0) > (best.grade?.tier?.rank || 0) ? s : best,
        _slabsForCard[0]);
      const _delta = gradedDeltaForSlab(archiveTopSlab, value);
      const _tierClass = (archiveTopSlab.grade?.tier?.id || 'na').toLowerCase().replace(/_/g, '-');
      const _gradeLbl  = archiveTopSlab.grade?.tier?.label || 'Graded';
      const _serial    = archiveTopSlab.serial || '—';
      const _moreCount = _slabsForCard.length - 1;
      archiveSectionHTML = `
        <div class="cdp-archive-section cdp-archive-section--${_tierClass}" id="cdp-archive-section">
          <div class="cdp-archive-section__head">
            <span class="cdp-archive-section__badge">AGS</span>
            <span class="cdp-archive-section__label">Archived copy available</span>
          </div>
          <div class="cdp-archive-section__body">
            <div class="cdp-archive-section__grade">${_gradeLbl}</div>
            <div class="cdp-archive-section__serial">${_serial}</div>
            <div class="cdp-archive-section__value">
              <span class="cdp-archive-section__val-raw">$${_delta.raw.toFixed(2)} raw</span>
              <span class="cdp-archive-section__val-arrow">→</span>
              <span class="cdp-archive-section__val-graded">$${_delta.graded.toFixed(2)}</span>
            </div>
            ${_moreCount > 0 ? `<div class="cdp-archive-section__more">+${_moreCount} more in registry</div>` : ''}
          </div>
          <button class="cdp-archive-section__cta" id="cdp-view-slab" type="button">View Archive Slab →</button>
        </div>
      `;
    }
  }

  const viewInBinderBtn = (isOwned && resolvedSetId)
    ? `<button class="cdp-view-binder-btn" id="cdp-view-binder">📖 View In Binder</button>` : '';
  const sellBtn = (isOwned && resolvedSetId)
    ? `<button class="cdp-sell-btn" id="cdp-sell">💰 Sell to Vendor</button>` : '';

  const html = `
    <div class="card-detail-content" id="cdp-panel">
      <div class="cdp-image-wrap">
        <img src="${imgSrc}" alt="${apiCard.name}" class="${imgClass}" />
        ${!isOwned ? `<div class="cdp-preview-badge">${rarityLbl}</div>` : ''}
      </div>
      <div class="card-detail-info">
        <div class="cdp-header-row">
          <div class="cdp-name">${apiCard.name}</div>
          ${isOwned ? `
            <button class="cdp-fav-btn ${favorited ? 'is-favorited' : ''}"
                    id="cdp-fav-btn" type="button"
                    aria-label="${favorited ? 'Remove from favorites' : 'Add to favorites'}"
                    aria-pressed="${favorited ? 'true' : 'false'}">
              ${favorited ? '♥' : '♡'}
            </button>` : ''}
        </div>
        <div class="cdp-rarity cdp-rarity-${rarityTier}">${rarityLbl}</div>
        ${setLine  ? `<div class="cdp-set">${setLine}</div>` : ''}
        ${chainHTML}
        <div class="cdp-divider"></div>
        ${archiveSectionHTML}
        <div class="cdp-row"><span>Est. Value</span><span class="cdp-value">$${value.toFixed(2)}</span></div>
        <div class="cdp-row"><span>Pull Rate</span><span>${pullRate}</span></div>
        ${types  ? `<div class="cdp-row"><span>Type</span><span>${types}</span></div>`  : ''}
        ${hp     ? `<div class="cdp-row"><span>HP</span><span>${hp}</span></div>`       : ''}
        ${stage  ? `<div class="cdp-row"><span>Stage</span><span>${stage}</span></div>` : ''}
        ${artist ? `<div class="cdp-row"><span>Artist</span><span>${artist}</span></div>` : ''}
        ${ownedLine}
        ${rhLine}
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
  return { html, archiveTopSlab };
}

function attachCardDetailListeners(modal, apiCard, ownedEntry, resolvedSetId, value, archiveTopSlab) {
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

  const favBtn = modal.querySelector('#cdp-fav-btn');
  if (favBtn) {
    favBtn.onclick = e => {
      e.stopPropagation();
      haptic('soft');
      const nowFav = toggleFavorite(apiCard.id);
      favBtn.classList.toggle('is-favorited', nowFav);
      favBtn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
      favBtn.setAttribute('aria-label', nowFav ? 'Remove from favorites' : 'Add to favorites');
      favBtn.textContent = nowFav ? '♥' : '♡';
      logActivity(
        nowFav ? 'favorited' : 'unfavorited',
        nowFav ? `Added ${apiCard.name} to Favorites` : `Removed ${apiCard.name} from Favorites`
      );
      try { refreshFavoritesScreen(); } catch {}
    };
  }

  modal.querySelectorAll('.evo-node:not(.evo-node--current)').forEach(node => {
    node.style.cursor = 'pointer';
    node.onclick = e => {
      e.stopPropagation();
      const tid = node.dataset.evoId;
      const setCards = getCachedSetCards(resolvedSetId) || [];
      const target = setCards.find(c => c.id === tid);
      if (!target) return;
      const ownedEvo = getCollection()[resolvedSetId]?.[tid] ?? null;
      tearDownCardDetailEscape();
      hideScreen(modal);
      unlockBodyScroll();
      setTimeout(() => openCardDetail(target, ownedEvo, resolvedSetId), 60);
    };
  });

  const viewBtn = modal.querySelector('#cdp-view-binder');
  if (viewBtn) {
    viewBtn.onclick = e => {
      e.stopPropagation();
      tearDownCardDetailEscape();
      hideScreen(modal);
      unlockBodyScroll();
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

  const viewSlabBtn = modal.querySelector('#cdp-view-slab');
  if (viewSlabBtn && archiveTopSlab) {
    viewSlabBtn.onclick = e => {
      e.stopPropagation();
      tearDownCardDetailEscape();
      hideScreen(modal);
      unlockBodyScroll();
      setTimeout(() => openSlabViewer(archiveTopSlab, apiCard, { rawValue: value, hooks: AGS_SCREEN_HOOKS }), 220);
    };
  }

  const sellBtnEl = modal.querySelector('#cdp-sell');
  if (sellBtnEl) {
    sellBtnEl.onclick = e => {
      e.stopPropagation();
      tearDownCardDetailEscape();
      hideScreen(modal);
      setTimeout(() => openSellModal(apiCard, ownedEntry, resolvedSetId), 260);
    };
  }
}

function openCardDetail(apiCard, ownedEntry, setId) {
  const modal = document.getElementById('card-detail-modal');
  // Phase 10.1.8: ?nooverlays=1 removes this node from the DOM at boot.
  // Without this guard, every card tap would crash with TypeError.
  if (!modal) {
    console.warn('[Modal] #card-detail-modal not in DOM — open SKIPPED (nooverlays flag?)');
    return;
  }

  tearDownCardDetailEscape();

  const resolvedSetId = setId || apiCard.set?.id;
  const rarityTier = mapPokemonRarity(apiCard.rarity) || 'common';
  const value      = getMarketValue(apiCard.id, rarityTier);

  const { html, archiveTopSlab } = buildCardDetailHTML(apiCard, ownedEntry, resolvedSetId, value, rarityTier);
  modal.innerHTML = html;

  attachCardDetailListeners(modal, apiCard, ownedEntry, resolvedSetId, value, archiveTopSlab);

  showScreen(modal);
  lockBodyScroll();
  modal.onclick = () => {
    tearDownCardDetailEscape();
    hideScreen(modal);
    unlockBodyScroll();
  };
  _disposeCardDetailEscape = onEscapeKey((e) => {
    e.preventDefault();
    if (modal.classList.contains('hidden')) return;
    tearDownCardDetailEscape();
    hideScreen(modal);
    unlockBodyScroll();
  });
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
  const agsLocked  = Number(lockedCopiesFor(setId, apiCard.id)) || 0;
  const rawAvailable = Math.max(0, (ownedEntry.count || 0) - agsLocked);
  if (rawAvailable <= 0) {
    showToast('All copies of this card are archived or under AGS review.', 'warn');
    return;
  }
  const gated      = isSellGated(setId, apiCard.id, rawAvailable);
  const isFav      = isFavorited(apiCard.id);

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
      ${isFav ? `
        <div class="sell-warning sell-warning--fav">
          <div class="sell-warning-icon">♥</div>
          <div class="sell-warning-text">
            <div class="sell-warning-title">Part of your Favorites Collection</div>
            <div>This card is in your personal showcase. Selling will remove it from your favorites as well.</div>
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
      // v1.2.0 — check if it was a duplicate before the sell removes it
      const preSellEntry = getCollection()[setId]?.[apiCard.id];
      const wasDuplicate = preSellEntry && preSellEntry.count > 1;
      let result;
      try {
        result = sellCard(setId, apiCard.id, rarityTier, selectedVendor, { force: true });
      } catch (err) {
        console.warn('[sell] sale blocked', err);
        showToast('No raw copy is available to sell.', 'warn');
        return;
      }
      // v1.5.1 — sold favorites no longer represent owned copies.
      if (isFav && ownedEntry.count <= 1) {
        try { toggleFavorite(apiCard.id); } catch {}
      }
      // stat tracking
      addLifetimeRevenue(result.payout);
      if (wasDuplicate) incrementDuplicatesSold();
      checkDistressTransition();
      updateBalanceUI();
      const vName = VENDORS[selectedVendor].name;
      showToast(`Sold for $${result.payout.toFixed(2)} · ${vName} Favor +${result.favorReward}`, 'sell');
      hideScreen(modal);
      unlockBodyScroll();
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

// v1.5.0 — AGS · Archive Services screen wiring. AGS_SCREEN_HOOKS and
// openAgsScreen are declared in the hoisting zone above renderVendorHub
// to satisfy the iOS WebKit TDZ rule.
// v1.5.1 — AGS top-bar button removed. Entry points are now the Collection
// page panel (#collection-ags-entry) and the Stats screen (#stats-ags-entry).
// `openAgsScreen` is still exposed via AGS_SCREEN_HOOKS / module scope so the
// new entry panels and any deferred deep links can call it.
document.addEventListener('archive-services-closed', () => {
  if (_agsHubScrollLockHeld) {
    unlockBodyScroll();
    _agsHubScrollLockHeld = false;
  }
});

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
  const valCtx = {
    getCachedSetCards,
    allValues,
    getMarketValue,
    mapPokemonRarity,
  };

  for (const [setId, cards] of Object.entries(collection)) {
    const cached = getCachedSetCards(setId) || [];
    const byId   = Object.fromEntries(cached.map(c => [c.id, c]));
    setCardCounts[setId] = Object.keys(cards).length;
    for (const [cardId, entry] of Object.entries(cards)) {
      totalCards++;
      totalDupes += Math.max(0, entry.count - 1);
      const apiCard = byId[cardId];
      const tier    = apiCard ? mapPokemonRarity(apiCard.rarity) : 'common';
      const lineVal = lineValueForCollectionEntry(setId, cardId, entry, valCtx);
      totalValue   += lineVal;
      if (lineVal > mostValAmount)    { mostValAmount = lineVal; mostValCard = apiCard; }
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
    ${(() => {
      // v1.5.1 — Stats AGS entry link.
      try {
        const s = computeAgsEntrySummary();
        return `
          <div class="stats-ags-card" id="stats-ags-entry" role="button" tabindex="0"
               aria-label="Open Archive Grading Services">
            <div class="stats-ags-card__brand">
              <div class="stats-ags-card__mark">AGS</div>
              <div class="stats-ags-card__text">
                <div class="stats-ags-card__title">Archive Grading Services</div>
                <div class="stats-ags-card__tagline">Preservation · Authentication · Prestige</div>
              </div>
            </div>
            <div class="stats-ags-card__stats">
              <div class="stats-ags-card__stat"><span>${s.archived}</span><em>Archived</em></div>
              <div class="stats-ags-card__stat"><span>${s.highest}</span><em>Top Grade</em></div>
            </div>
          </div>
        `;
      } catch { return ''; }
    })()}

    <div class="stats-rank-card stats-rank-card--clickable" id="stats-rank-card-link" role="button" aria-label="Open Collector Archive" style="cursor:pointer">
      <div class="stats-rank-label">Collector Rank <span class="stats-rank-tap-hint">· Tap to view archive</span></div>
      <div class="stats-rank-name">${rank.name}</div>
      <div class="stats-rank-points">${rank.current} reputation${rank.nextMin ? ` · next at ${rank.nextMin}` : ''}</div>
    </div>

    ${(() => {
      // v1.4.0 — Collection Prestige tier card
      try {
        const p = getPrestigeTier();
        return `
          <div class="stats-prestige-card">
            <div class="stats-prestige-label">Collection Prestige</div>
            <div class="stats-prestige-name">${p.name}</div>
            <div class="stats-prestige-bar"><div class="stats-prestige-fill" style="width:${p.progressPct.toFixed(0)}%"></div></div>
            <div class="stats-prestige-meta">${p.score} pts${p.nextMin ? ` · next tier at ${p.nextMin}` : ' · top tier'}</div>
          </div>
        `;
      } catch { return ''; }
    })()}

    ${(() => {
      // v1.4.0 — Collection Value summary + sparkline
      try {
        // Snapshot current value so the summary always reflects "now"
        recordCollectionValueSnapshot();
        const v = getValueSummary();
        const sign = v.delta > 0 ? '+' : (v.delta < 0 ? '' : '');
        const dColor = v.delta > 0 ? 'is-up' : (v.delta < 0 ? 'is-down' : '');
        // Inline sparkline (last up-to-30 points)
        let pts = v.points.slice(-30);
        if (pts.length === 1) {
          pts = [pts[0], { ...pts[0] }];
        }
        let sparkSvg = '';
        if (pts.length >= 2) {
          const max = Math.max(...pts.map(p => p.value), 1);
          const min = Math.min(...pts.map(p => p.value));
          const span = Math.max(1, max - min);
          const w = 220, h = 36;
          const stepX = w / (pts.length - 1);
          const path = pts.map((p, i) => {
            const x = i * stepX;
            const y = h - ((p.value - min) / span) * h;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ');
          sparkSvg = `<svg class="stats-value-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" /></svg>`;
        } else {
          sparkSvg = `<div class="stats-value-spark stats-value-spark--empty">More history coming…</div>`;
        }
        return `
          <div class="stats-value-card">
            <div class="stats-value-head">
              <div class="stats-value-label">Collection Value</div>
              <div class="stats-value-meta ${dColor}">${sign}$${Math.abs(v.delta).toFixed(2)} vs prior · peak $${v.peak.toFixed(2)}</div>
            </div>
            <div class="stats-value-current">$${v.today.toFixed(2)}</div>
            ${sparkSvg}
          </div>
        `;
      } catch { return ''; }
    })()}

    ${(() => {
      // v1.4.0 — Archive History panel
      try {
        const entries = getArchiveEntries(6);
        if (!entries.length) {
          return `
            <div class="stats-archive-card">
              <div class="stats-archive-label">Archive History</div>
              <div class="stats-archive-empty">Your collector log will fill in as you pull, complete sets, and weather the market.</div>
            </div>
          `;
        }
        const rows = entries.map(e => `
          <div class="stats-archive-row">
            <span class="stats-archive-day">Day ${e.day}</span>
            <span class="stats-archive-text">${e.label}</span>
          </div>
        `).join('');
        return `
          <div class="stats-archive-card">
            <div class="stats-archive-label">Archive History</div>
            ${rows}
          </div>
        `;
      } catch { return ''; }
    })()}

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${packsOpened}</div><div class="stat-label">Packs Opened</div></div>
      <div class="stat-card"><div class="stat-value">${totalCards}</div><div class="stat-label">Unique Cards</div></div>
      <div class="stat-card"><div class="stat-value">${avgCompletion.toFixed(1)}%</div><div class="stat-label">Avg. Completion</div></div>
      <div class="stat-card"><div class="stat-value">$${totalValue.toFixed(2)}</div><div class="stat-label">Collection Value</div></div>
      <div class="stat-card"><div class="stat-value">${secretRares}</div><div class="stat-label">Secret Rares</div></div>
      <div class="stat-card stat-card--clickable" id="stat-card-duplicates" role="button" aria-label="Open Duplicate Vault"><div class="stat-value">${totalDupes}</div><div class="stat-label">Duplicates · Tap to manage</div></div>
      <div class="stat-card"><div class="stat-value">${wishlistHits}</div><div class="stat-label">Wishlist Owned</div></div>
      <div class="stat-card"><div class="stat-value stat-value--small">${favSetName}</div><div class="stat-label">Most Collected</div></div>
    </div>

    <div class="stats-section-title">Vendor Favor</div>
    <div class="stats-favor-list">${favorRows}</div>

    ${mostValCard ? `
    <div class="stats-showcase" id="showcase-most-val" style="cursor:pointer">
      <div class="stats-showcase-label">Most Valuable Card</div>
      <img src="${mostValCard.images.small || mostValCard.images.large}" alt="${mostValCard.name}" class="stats-showcase-img" loading="lazy" />
      <div class="stats-showcase-name">${mostValCard.name}</div>
      <div class="stats-showcase-value">$${mostValAmount.toFixed(2)}</div>
    </div>` : '<p class="stats-empty">Open some packs to see your stats!</p>'}

    ${rarestCard && rarestIdx !== -1 ? `
    <div class="stats-showcase" id="showcase-rarest" style="cursor:pointer">
      <div class="stats-showcase-label">Rarest Pull</div>
      <img src="${rarestCard.images.small || rarestCard.images.large}" alt="${rarestCard.name}" class="stats-showcase-img" loading="lazy" />
      <div class="stats-showcase-name">${rarestCard.name}</div>
      <div class="stats-showcase-value">${RARITY_LABELS[RARITY_ORDER[rarestIdx]] || ''}</div>
    </div>` : ''}
  `;

  const dupCard = container.querySelector('#stat-card-duplicates');
  if (dupCard) {
    dupCard.addEventListener('click', () => openDuplicateVault());
    iosTap(dupCard, () => openDuplicateVault());
  }

  // v1.5.1 — Stats AGS entry tap → openAgsScreen.
  const agsEntry = container.querySelector('#stats-ags-entry');
  if (agsEntry) {
    const _open = () => { haptic('soft'); openAgsScreen(); };
    agsEntry.addEventListener('click', _open);
    iosTap(agsEntry, _open);
    agsEntry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _open(); }
    });
  }

  // v1.2.0 — rank card opens Collector Archive
  const rankCard = container.querySelector('#stats-rank-card-link');
  if (rankCard) {
    rankCard.addEventListener('click', () => openCollectorArchive());
    iosTap(rankCard, () => openCollectorArchive());
  }

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
