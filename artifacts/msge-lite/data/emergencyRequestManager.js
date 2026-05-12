/**
 * data/emergencyRequestManager.js — v1.3.0a (Phase A)
 *
 * Emergency Requests — recovery-only contracts surfaced by the vendor
 * holding the Recovery Mode focus. They are completely independent from
 * the regular Collector Requests system:
 *
 *  - Separate storage namespace (tcg_emergency_requests)
 *  - 45-minute rotation, in lockstep with the recovery focus rotation
 *  - Per-vendor profile (PokéMart simple, Retro Vault archive,
 *    Night Market volatile, Broker prestige liquidation)
 *  - Reduced reputation reward (recovery is survival, not progression)
 *  - At most ONE emergency request per render cycle, attached to the
 *    current focus vendor only
 *
 * The eligibility math reuses requestManager.findEligibleCards() so locked
 * cards, sole copies, and wishlisted cards stay protected by the same
 * rules as regular requests.
 */

import { decrementCard }                from './collectionManager.js';
import { findEligibleCards }            from './requestManager.js';
import {
  getRecoveryFocusVendor,
  vendorAcceptsRecovery,
}                                       from './recoveryManager.js';
import { getRank }                      from './reputationManager.js';

const STORAGE_KEY      = 'tcg_emergency_requests';
const REFRESH_MS       = 45 * 60 * 1000;
const RANK_ORDER       = [
  'Rookie Collector', 'Collector', 'Advanced Collector',
  'Elite Collector', 'Master Collector', 'Archive Curator', 'Legendary Collector',
];

const RARITY_LABELS = {
  common:           'common',
  uncommon:         'uncommon',
  rare:             'rare',
  holoRare:         'holo',
  doubleRare:       'double rare',
  illustrationRare: 'illustration rare',
  ultraRare:        'ultra rare',
  hyperRare:        'hyper rare',
};

// Per-vendor emergency request profiles. Reward bands match the spec:
// PokéMart $10-22, Retro Vault $14-30, Night Market $18-45, Broker $250-1000.
// repPenalty is a multiplier applied to whatever reputation the regular
// flow would award — recovery should not bankroll progression.
const EMERGENCY_PROFILES = {
  pokemart: {
    flavor:        'Emergency Collector Work',
    rarityPool:    ['common', 'uncommon'],
    quantityRange: [2, 3],
    rewardRange:   [10, 22],
    repReward:     1,    // tiny rep — survival, not progression
    favorReward:   1,
    note:          'Quick turnaround. PokéMart pays cash on delivery.',
  },
  retroVault: {
    flavor:        'Archive Liquidation',
    rarityPool:    ['rare', 'holoRare'],
    quantityRange: [1, 2],
    rewardRange:   [14, 30],
    repReward:     1,
    favorReward:   2,
    note:          'The Vault accepts older inventory. Discretion expected.',
  },
  nightMarket: {
    flavor:        'Volatile Contract',
    rarityPool:    ['rare', 'holoRare'],
    quantityRange: [1, 2],
    rewardRange:   [18, 45],
    repReward:     1,
    favorReward:   2,
    note:          'Risk and reward in equal measure.',
    volatileTags:  ['volatile', 'risky', 'unverified'],
  },
  broker: {
    // Prestige liquidation. Only ever offered when the player is at least
    // Master Collector AND the per-rotation rare-chance roll succeeds.
    flavor:        'Prestige Liquidation',
    rarityPool:    ['ultraRare', 'hyperRare'],
    quantityRange: [1, 1],
    rewardRange:   [250, 1000],
    repReward:     5,
    favorReward:   3,
    note:          'A discreet buyer. Status-bound.',
    minRank:       'Master Collector',
    rareChance:    0.3,           // only ~30% of broker rotations offer anything
    mode:          'acquire',     // can consume any unlocked owned copy
  },
};

const rand    = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 0.999));
const pick    = (arr)    => arr[Math.floor(Math.random() * arr.length)];

function rankIndex(name) {
  const i = RANK_ORDER.indexOf(name);
  return i < 0 ? 0 : i;
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

let _idCounter = 0;
function newId() {
  return `emerg_${Date.now().toString(36)}_${(_idCounter++).toString(36)}`;
}

/**
 * Generates a single emergency request for the given vendor, or null
 * if the vendor refuses (broker rare-chance roll failed, rank gate, etc).
 */
function generateEmergencyRequest(vendorId) {
  const cfg = EMERGENCY_PROFILES[vendorId];
  if (!cfg) return null;

  const rankName = getRank().name;
  if (cfg.minRank && rankIndex(rankName) < rankIndex(cfg.minRank)) return null;
  if (typeof cfg.rareChance === 'number' && Math.random() > cfg.rareChance) return null;

  const rarity   = pick(cfg.rarityPool);
  const quantity = randInt(cfg.quantityRange[0], cfg.quantityRange[1]);
  const reward   = randInt(cfg.rewardRange[0], cfg.rewardRange[1]);
  const tag      = cfg.volatileTags ? pick(cfg.volatileTags) : null;
  const mode     = cfg.mode || 'duplicate';
  const verb     = mode === 'acquire' ? '' : ' duplicate';

  return {
    id:           newId(),
    vendorId,
    isEmergency:  true,
    isPrestige:   mode === 'acquire',
    type:         mode === 'acquire' ? 'rarityAcquire' : 'rarity',
    criteria:     { kind: 'rarity', rarity, mode },
    quantity,
    title:        `Seeking ${quantity} ${RARITY_LABELS[rarity] || rarity}${verb}${quantity > 1 ? 's' : ''}`,
    reward,
    favorReward:  cfg.favorReward,
    repReward:    cfg.repReward,
    flavorLabel:  cfg.flavor,
    note:         cfg.note,
    volatileTag:  tag,
    demandModifier: 0,
    createdAt:    Date.now(),
  };
}

/**
 * Returns the active emergency request for the recovery focus vendor, or
 * null. Lazily refreshes when the 45-minute window expires. Ignored entirely
 * when not in recovery, or when the focus vendor is not the one passed in.
 */
export function getEmergencyRequestForVendor(vendorId) {
  const focus = getRecoveryFocusVendor();
  if (!focus || focus !== vendorId) return null;
  if (!vendorAcceptsRecovery(vendorId)) return null;

  const all  = load();
  const slot = all[vendorId];
  const now  = Date.now();

  // Lockstep guard: also regenerate when the focus has rotated since the
  // slot was created (recoveryManager wipes EMERGENCY_KEY on rotation,
  // but this is a defensive cross-check in case the wipe was missed).
  let focusRotatedAt = 0;
  try {
    const recState = JSON.parse(localStorage.getItem('tcg_recovery_state')) || {};
    focusRotatedAt = recState.focusRotatedAt || 0;
  } catch {}

  const stale = !slot
    || (now - slot.refreshedAt) >= REFRESH_MS
    || slot.refreshedAt < focusRotatedAt;

  if (stale) {
    const req = generateEmergencyRequest(vendorId);
    all[vendorId] = { request: req, refreshedAt: now };
    // Wipe other vendors' slots — only the focus vendor can hold one.
    for (const v of Object.keys(all)) {
      if (v !== vendorId) delete all[v];
    }
    save(all);
    return req;
  }
  return slot.request || null;
}

/** ms until the active emergency slot rotates. */
export function timeUntilRotationMs(vendorId) {
  const slot = load()[vendorId];
  if (!slot) return 0;
  return Math.max(0, slot.refreshedAt + REFRESH_MS - Date.now());
}

export function getRotationLabel(vendorId) {
  const ms = timeUntilRotationMs(vendorId);
  if (ms <= 0) return 'rotating soon';
  const totalM = Math.ceil(ms / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return h > 0 ? `Rotates in ${h}h ${m}m` : `Rotates in ${m}m`;
}

/**
 * Atomically consume the required cards and clear the emergency slot.
 * Returns { ok: true, reward, favorReward, repReward, vendorId }
 *      or { ok: false, reason }.
 */
export function completeEmergencyRequest(requestId) {
  const all = load();
  let request = null, vendorId = null;
  for (const v of Object.keys(all)) {
    const r = all[v]?.request;
    if (r && r.id === requestId) { request = r; vendorId = v; break; }
  }
  if (!request) return { ok: false, reason: 'not-found' };

  const eligible = findEligibleCards(request);
  let total = 0;
  for (const e of eligible) total += e.available;
  if (total < request.quantity) return { ok: false, reason: 'insufficient' };

  // Greedy: prefer cards we have most copies of, so thin duplicates stay safe.
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

  // Clear the slot — emergency requests are one-shot per rotation.
  delete all[vendorId];
  save(all);

  return {
    ok:          true,
    reward:      request.reward,
    favorReward: request.favorReward,
    repReward:   request.repReward,
    vendorId,
  };
}

/** Dev tool — wipe all emergency slots. */
export function clearAllEmergencyRequests() {
  localStorage.removeItem(STORAGE_KEY);
}
