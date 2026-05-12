/**
 * data/requestManager.js — Phase 10.4 / Phase 10.5
 *
 * Collector Requests subsystem.
 *
 * Vendors post rotating requests for specific kinds of cards. Players
 * complete them by surrendering matching DUPLICATES (and, for the
 * Broker's "acquisition" requests, owned cards that the player has
 * explicitly unlocked). Rewards are cash + vendor favor, modulated by
 * a per-vendor "demand" multiplier so the economy feels alive without
 * becoming a stock-market simulator.
 *
 * Phase 10.5 changes:
 *  - Broker overhaul: dual-mode requests (`rarityDuplicate` for spare
 *    high-rarity dupes, `rarityAcquire` for prestige acquisitions that
 *    can consume any UNLOCKED owned copy). Prestige flavor titles
 *    ('Museum Acquisition', 'Private Buyer', etc).
 *  - Dynamic rewards: estimated sell value × contract bonus × demand
 *    (broker only). Hard cap $1000.
 *  - Rank scaling: rarity pool is filtered by current Collector Rank
 *    so early-game players never see ultra-rare requests they can't
 *    fulfill, and late-game players see prestige contracts.
 *
 * Storage key: tcg_vendor_requests
 *   { [vendorId]: { requests: Request[], lastRefresh: number } }
 */

import { getCollection, decrementCard }   from './collectionManager.js';
import { rawCopiesAvailable }             from './agsAvailability.js';
import { getWishlist }                    from './wishlistManager.js';
import { getCachedSetCards }              from './cardPoolManager.js';
import { mapPokemonRarity }               from './rarityMapper.js';
import { isVendorOpen }                   from './vendorManager.js';

const STORAGE_KEY = 'tcg_vendor_requests';

// ─── Rarity ladder ────────────────────────────────────────────────────────────
// Ordered weakest → strongest. Used for rank-scaling cuts.

const RARITY_TIERS = [
  'common', 'uncommon', 'rare', 'holoRare', 'doubleRare',
  'illustrationRare', 'ultraRare', 'specialIllustrationRare', 'hyperRare',
];

// Representative dollar value per rarity. Used to estimate Broker payouts
// without binding the request to a specific card. Tracks the rough
// midpoint of marketValue.js volatility bands.
const RARITY_BASE_VALUE = {
  common:                 1,
  uncommon:               2,
  rare:                   5,
  holoRare:              12,
  doubleRare:            30,
  illustrationRare:      65,
  ultraRare:             90,
  specialIllustrationRare: 200,
  hyperRare:            350,
};

// ─── Rank scaling ─────────────────────────────────────────────────────────────
// Caps the highest rarity any vendor will ever request for a player at
// this rank. Early game = duplicates of commons; late game = prestige
// hyper rares. Applied as a *ceiling* — vendors still respect their
// own rarityPool floor.

const RANK_RARITY_CEILING = {
  'Rookie Collector':       'rare',
  'Collector':              'holoRare',
  'Advanced Collector':     'doubleRare',
  'Elite Collector':        'illustrationRare',
  'Master Collector':       'ultraRare',
  'Archive Curator':        'specialIllustrationRare',
  'Legendary Collector':    'hyperRare',
};

// Quantity scalar — slightly thinner contracts at the bottom so new
// players always see something achievable.
const RANK_QUANTITY_MULT = {
  'Rookie Collector':       0.7,
  'Collector':              0.85,
  'Advanced Collector':     1.0,
  'Elite Collector':        1.0,
  'Master Collector':       1.1,
  'Archive Curator':        1.1,
  'Legendary Collector':    1.2,
};

function ceilingIndex(rankName) {
  const tier = RANK_RARITY_CEILING[rankName] ?? 'doubleRare';
  return RARITY_TIERS.indexOf(tier);
}

function scaledQuantity(rankName, baseLo, baseHi) {
  const m  = RANK_QUANTITY_MULT[rankName] ?? 1.0;
  const lo = Math.max(1, Math.round(baseLo * m));
  const hi = Math.max(lo, Math.round(baseHi * m));
  return [lo, hi];
}

function filterRarityPoolByRank(pool, rankName) {
  const cap = ceilingIndex(rankName);
  const out = pool.filter(r => RARITY_TIERS.indexOf(r) <= cap);
  // Always leave SOMETHING — fall back to the lowest rarity in the pool.
  return out.length ? out : [pool[0]];
}

// ─── Vendor personalities ─────────────────────────────────────────────────────
// Each vendor's distinct request flavor + economy band. Reward bands stay
// modest on purpose for non-broker vendors — we never want requests to
// out-earn pack opening.

const VENDOR_CONFIG = {
  pokemart: {
    refreshMs:        2 * 3_600_000,
    countRange:       [1, 2],
    demandRange:      [0.0,  0.20],
    flavor:           'Open Request',
    types:            ['type', 'rarity'],
    rarityPool:       ['common', 'uncommon', 'rare'],
    quantityRange:    [2, 4],
    perCardReward:    4,
  },
  retroVault: {
    refreshMs:        4 * 3_600_000,
    countRange:       [1, 2],
    demandRange:      [-0.10, 0.35],
    flavor:           'Archive Request',
    types:            ['rarity', 'set'],
    rarityPool:       ['rare', 'holoRare', 'doubleRare'],
    quantityRange:    [1, 2],
    perCardReward:    16,
  },
  nightMarket: {
    refreshMs:        3 * 3_600_000,
    countRange:       [1, 3],
    demandRange:      [-0.20, 0.60],
    flavor:           'Quiet Exchange',
    types:            ['type', 'rarity'],
    rarityPool:       ['common', 'uncommon', 'rare', 'holoRare'],
    quantityRange:    [2, 3],
    perCardReward:    7,
  },
  broker: {
    // Phase 10.5 — acquisition-focused, premium-paying, rare to refresh.
    refreshMs:        8 * 3_600_000,
    countRange:       [1, 1],     // appears less frequently — usually 1 contract
    demandRange:      [0.10, 0.50],
    flavor:           'Collector Bounty',
    types:            ['rarityAcquire', 'rarityDuplicate'],   // mostly acquire (see weights)
    typeWeights:      [0.7, 0.3], // 70% acquire, 30% duplicate
    rarityPool:       ['doubleRare', 'illustrationRare', 'ultraRare', 'specialIllustrationRare', 'hyperRare'],
    quantityRange:    [1, 2],
    contractBonusRange: [0.15, 0.40],   // +15-40% above estimated sell value
    brokerPremiumMult:  1.5,            // baseline lift so even modest contracts hit the $120 floor
    rewardCap:          1000,
    prestigeFlavors:  ['Museum Acquisition', 'Private Buyer', 'Collector Bounty', 'Archive Commission'],
  },
};

const POKEMON_TYPES = [
  'Grass', 'Fire', 'Water', 'Lightning', 'Psychic',
  'Fighting', 'Darkness', 'Metal', 'Dragon', 'Fairy',
];

const RARITY_LABELS = {
  common:                  'common',
  uncommon:                'uncommon',
  rare:                    'rare',
  holoRare:                'holo',
  doubleRare:              'double rare',
  illustrationRare:        'illustration rare',
  ultraRare:               'ultra rare',
  specialIllustrationRare: 'special illustration rare',
  hyperRare:               'hyper rare',
};

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveAll(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function newId(vendorId) {
  return `${vendorId}_${Date.now().toString(36)}_${(_idCounter++).toString(36)}`;
}
const rand    = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 0.999));
const pick    = (arr)    => arr[Math.floor(Math.random() * arr.length)];

function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Request generation ───────────────────────────────────────────────────────

function generateRequest(vendorId, knownSetIds, rankName) {
  const cfg = VENDOR_CONFIG[vendorId];
  if (!cfg) return null;

  // Pick request type (weighted for broker, uniform elsewhere)
  const type = (cfg.typeWeights && cfg.types.length === cfg.typeWeights.length)
    ? pickWeighted(cfg.types, cfg.typeWeights)
    : pick(cfg.types);

  // Quantity — scaled by rank for non-broker. Broker keeps tight 1-2 contracts.
  const [qLo, qHi] = vendorId === 'broker'
    ? cfg.quantityRange
    : scaledQuantity(rankName, cfg.quantityRange[0], cfg.quantityRange[1]);
  const quantity = randInt(qLo, qHi);

  const demand = +rand(cfg.demandRange[0], cfg.demandRange[1]).toFixed(2);

  // Rank-filtered rarity pool. Always at least one entry.
  const filteredPool = filterRarityPoolByRank(cfg.rarityPool, rankName);

  let criteria, title, flavorLabel = cfg.flavor;
  if (type === 'type') {
    const t  = pick(POKEMON_TYPES);
    criteria = { kind: 'type', type: t, mode: 'duplicate' };
    title    = `Seeking ${quantity} duplicate ${t}-type card${quantity > 1 ? 's' : ''}`;
  } else if (type === 'rarity' || type === 'rarityDuplicate') {
    const r  = pick(filteredPool);
    criteria = { kind: 'rarity', rarity: r, mode: 'duplicate' };
    title    = `Seeking ${quantity} ${RARITY_LABELS[r]} duplicate${quantity > 1 ? 's' : ''}`;
  } else if (type === 'set') {
    if (!knownSetIds || knownSetIds.length === 0) return null;
    const setId = pick(knownSetIds);
    criteria    = { kind: 'set', setId, mode: 'duplicate' };
    title       = `Archive Acquisition: ${quantity} duplicate${quantity > 1 ? 's' : ''} from a curated set`;
  } else if (type === 'rarityAcquire') {
    const r  = pick(filteredPool);
    flavorLabel = pick(cfg.prestigeFlavors || [cfg.flavor]);
    criteria    = { kind: 'rarity', rarity: r, mode: 'acquire' };
    title       = `${flavorLabel}: ${quantity} ${RARITY_LABELS[r]}${quantity > 1 ? 's' : ''}`;
  } else {
    return null;
  }

  // ─── Reward calculation ────────────────────────────────────────────────────
  let reward, baseReward;
  if (vendorId === 'broker') {
    const rarityKey = criteria.kind === 'rarity' ? criteria.rarity : 'rare';
    const baseValue = (RARITY_BASE_VALUE[rarityKey] ?? 5) * cfg.brokerPremiumMult;
    const contractBonus = 1 + rand(cfg.contractBonusRange[0], cfg.contractBonusRange[1]);
    baseReward = Math.round(quantity * baseValue);
    reward     = Math.min(
      cfg.rewardCap,
      Math.round(quantity * baseValue * contractBonus * (1 + demand))
    );
    reward = Math.max(120, reward);   // broker floor — feels prestigious
  } else {
    baseReward = quantity * cfg.perCardReward;
    reward     = Math.max(2, Math.round(baseReward * (1 + demand)));
  }
  const favorReward = Math.max(1, Math.round(quantity * 2 * (1 + demand * 0.5)));

  return {
    id: newId(vendorId),
    vendorId,
    type, criteria, quantity,
    title,
    baseReward,
    demandModifier: demand,
    reward,
    favorReward,
    flavorLabel,
    isPrestige: type === 'rarityAcquire',
    createdAt: Date.now(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get this vendor's active requests, lazily refreshing if their cohort has
 * expired or never been generated. Pass any setIds you want eligible for
 * "set" criteria (typically the vendor's current pack stock setIds).
 *
 * `rankName` is the player's current Collector Rank (from
 * reputationManager.getRank().name) — used to scale request difficulty.
 *
 * Returns an empty array for the Broker when closed.
 */
export function getRequestsForVendor(vendorId, knownSetIds = [], rankName = 'Collector') {
  const cfg = VENDOR_CONFIG[vendorId];
  if (!cfg) return [];
  if (vendorId === 'broker' && !isVendorOpen('broker')) return [];

  const all  = loadAll();
  const slot = all[vendorId] || { requests: [], lastRefresh: 0 };
  const now  = Date.now();
  const stale = now - slot.lastRefresh >= cfg.refreshMs;

  if (stale || slot.requests.length === 0) {
    const target = randInt(cfg.countRange[0], cfg.countRange[1]);
    const fresh  = [];
    let attempts = 0;
    while (fresh.length < target && attempts < 8) {
      const r = generateRequest(vendorId, knownSetIds, rankName);
      if (r) fresh.push(r);
      attempts++;
    }
    slot.requests    = fresh;
    slot.lastRefresh = now;
    all[vendorId]    = slot;
    saveAll(all);
  }
  return slot.requests;
}

/** Returns ms until this vendor's next rotation, 0 if due now. */
export function getNextRefreshMs(vendorId) {
  const cfg = VENDOR_CONFIG[vendorId];
  if (!cfg) return Infinity;
  const slot = loadAll()[vendorId];
  if (!slot) return 0;
  return Math.max(0, slot.lastRefresh + cfg.refreshMs - Date.now());
}

/** Friendly "Rotates in Xh Ym" label. */
export function getRefreshLabel(vendorId) {
  const ms = getNextRefreshMs(vendorId);
  if (ms <= 0) return 'rotating soon';
  const h = Math.floor(ms /  3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `Rotates in ${h}h ${m}m` : `Rotates in ${m}m`;
}

/** True if any vendor's requests have aged past their refresh window. */
export function anyVendorRequestsStale() {
  const all = loadAll();
  const now = Date.now();
  for (const v of Object.keys(VENDOR_CONFIG)) {
    const slot = all[v];
    if (!slot) continue;
    if (now - slot.lastRefresh >= VENDOR_CONFIG[v].refreshMs) return true;
  }
  return false;
}

// ─── Eligibility / completion ─────────────────────────────────────────────────

function matchesCriteria(setId, cardId, criteria) {
  if (criteria.kind === 'set') return setId === criteria.setId;

  // Type & rarity require API metadata (loaded lazily by cardPoolManager).
  // If a set isn't preloaded yet, that card simply isn't matchable — safe.
  const cached  = getCachedSetCards(setId) || [];
  const apiCard = cached.find(c => c.id === cardId);
  if (!apiCard) return false;

  if (criteria.kind === 'type') {
    return Array.isArray(apiCard.types) && apiCard.types.includes(criteria.type);
  }
  if (criteria.kind === 'rarity') {
    return mapPokemonRarity(apiCard.rarity) === criteria.rarity;
  }
  return false;
}

/**
 * Find cards matching this request's criteria.
 *
 * Two modes (read from request.criteria.mode, default 'duplicate'):
 *
 *  - 'duplicate' — only counts duplicates beyond the sole copy.
 *      `available = max(0, count - 1)`
 *      Used by every vendor except prestige Broker contracts.
 *
 *  - 'acquire'   — prestige contract, can consume unlocked owned copies.
 *      Locked entries still preserve their last copy (mirrors
 *      sellingManager's locked-last-copy guard) — so the player must
 *      explicitly unlock a card to surrender its sole copy.
 *      Wishlisted cards are never consumed in either mode.
 *
 * Returns: [{ setId, cardId, available }]
 */
export function findEligibleCards(request) {
  const collection = getCollection();
  const wishlist   = getWishlist();
  const isAcquire  = request?.criteria?.mode === 'acquire';
  const eligible   = [];

  for (const setId of Object.keys(collection)) {
    for (const cardId of Object.keys(collection[setId])) {
      const entry = collection[setId][cardId];
      if (wishlist.has(cardId)) continue;
      if (!matchesCriteria(setId, cardId, request.criteria)) continue;

      const rawCount = rawCopiesAvailable(setId, cardId, entry.count);
      const entryLocked = entry.locked !== false;
      let available;
      if (isAcquire) {
        // Locked entries always preserve at least one raw copy.
        available = entryLocked
          ? Math.max(0, rawCount - 1)
          : rawCount;
      } else {
        // Duplicate mode preserves one raw copy. AGS-locked copies are not raw
        // inventory and must not be consumed by request fulfillment.
        if (entryLocked && rawCount <= 1) continue;
        available = Math.max(0, rawCount - 1);
      }
      if (available <= 0) continue;
      eligible.push({ setId, cardId, available });
    }
  }
  return eligible;
}

export function canCompleteRequest(request) {
  let total = 0;
  for (const e of findEligibleCards(request)) total += e.available;
  return total >= request.quantity;
}

/** Returns { completed, total } for partial-progress UI hints. */
export function getRequestProgress(request) {
  let total = 0;
  for (const e of findEligibleCards(request)) total += e.available;
  return {
    completed: Math.min(total, request.quantity),
    total:     request.quantity,
  };
}

/**
 * Atomically consume the required cards and remove the request.
 * Returns { ok: true, reward, favorReward, vendorId } or { ok: false, reason }.
 */
export function completeRequest(requestId) {
  const all = loadAll();
  let request = null, vendorId = null;
  for (const v of Object.keys(all)) {
    const r = (all[v].requests || []).find(x => x.id === requestId);
    if (r) { request = r; vendorId = v; break; }
  }
  if (!request) return { ok: false, reason: 'not-found' };

  const eligible = findEligibleCards(request);
  let total = 0;
  for (const e of eligible) total += e.available;
  if (total < request.quantity) return { ok: false, reason: 'insufficient' };

  // Greedy: prefer the cards we have the most copies of, so the
  // user's "thinnest" duplicates stay safest.
  eligible.sort((a, b) => b.available - a.available);
  let toConsume = request.quantity;
  for (const e of eligible) {
    while (toConsume > 0 && e.available > 0) {
      decrementCard(e.setId, e.cardId);
      e.available--;
      toConsume--;
    }
    if (toConsume === 0) break;
  }

  all[vendorId].requests = all[vendorId].requests.filter(x => x.id !== requestId);
  saveAll(all);

  return {
    ok:          true,
    reward:      request.reward,
    favorReward: request.favorReward,
    vendorId,
  };
}

/** Dev tool — wipe all stored requests so the next render generates a fresh batch. */
export function clearAllRequests() {
  localStorage.removeItem(STORAGE_KEY);
}
