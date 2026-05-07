/**
 * data/mysteryBoxManager.js — Phase 10.1
 *
 * Mystery boxes are sealed bundles containing 3 random packs drawn from a
 * weighted set pool. Designed as a deliberate economy sink with a slight
 * gamble — average expected value sits near box price, with occasional
 * profit and occasional small loss. No exploitative variance.
 *
 * Vendor placement (controlled in vendorManager / main.js):
 *   • Night Market  — always stocks the Midnight Bundle.
 *   • Retro Vault   — occasionally stocks the Vintage Archive Crate.
 *   • The Broker    — occasionally stocks the Collector Cache.
 *
 * Storage:
 *   tcg_box_offerings → { weekKey: string, retroVault: bool, broker: bool }
 *     (deterministic per ISO-week so offerings feel curated, not random
 *     every render)
 */

import { PACK_STORE } from './packStore.js';

export const MYSTERY_BOXES = {
  midnightBundle: {
    id:        'midnightBundle',
    name:      'Midnight Bundle',
    vendor:    'nightMarket',
    price:     54,
    packCount: 3,
    pool:      ['swsh11','sv2','sv3pt5','sv4pt5','swsh7'],
    weights:   [1, 1, 1, 1, 1],
    blurb:     'Three sealed packs from a rotating mix. Outcomes vary nightly.',
  },
  vintageArchiveCrate: {
    id:        'vintageArchiveCrate',
    name:      'Vintage Archive Crate',
    vendor:    'retroVault',
    price:     78,
    packCount: 3,
    pool:      ['swsh7','swsh11','swsh11'],   // weighted toward vintage SWSH
    weights:   [3, 2, 1],
    blurb:     'Curated vintage Sword & Shield era picks. Premium pricing.',
  },
  collectorCache: {
    id:        'collectorCache',
    name:      'Collector Cache',
    vendor:    'broker',
    price:     145,
    packCount: 3,
    pool:      ['sv3pt5','sv4pt5','swsh7'],
    weights:   [2, 2, 1],
    blurb:     'Hand-selected by The Broker. Trends toward high-yield sets.',
  },
};

const OFFERINGS_KEY = 'tcg_box_offerings';

/** ISO-ish week key — deterministic Monday rollover. */
function getWeekKey() {
  const d = new Date();
  const day = d.getDay();
  const daysSinceMon = (day + 6) % 7;
  d.setDate(d.getDate() - daysSinceMon);
  return 'WK-' + d.toISOString().slice(0, 10);
}

function loadOfferings() {
  try { return JSON.parse(localStorage.getItem(OFFERINGS_KEY)) || null; }
  catch { return null; }
}
function saveOfferings(o) { localStorage.setItem(OFFERINGS_KEY, JSON.stringify(o)); }

/**
 * Returns which optional boxes are stocked this week.
 * Generated once per week and persisted so the user sees stable inventory
 * during a single session.
 */
function ensureOfferings() {
  const wk = getWeekKey();
  const cur = loadOfferings();
  if (cur && cur.weekKey === wk) return cur;
  // Hash week key for deterministic-ish selection
  const seed = [...wk].reduce((a, c) => a + c.charCodeAt(0), 0);
  const next = {
    weekKey:    wk,
    retroVault: (seed % 2) === 0,        // ~50% of weeks
    broker:     (seed % 3) === 0,        // ~33% of weeks
  };
  saveOfferings(next);
  return next;
}

/** Returns array of box ids stocked at the given vendor right now. */
export function getBoxesForVendor(vendorId) {
  const offerings = ensureOfferings();
  const result = [];
  for (const box of Object.values(MYSTERY_BOXES)) {
    if (box.vendor !== vendorId) continue;
    if (vendorId === 'nightMarket') {
      result.push(box.id);                                 // always
    } else if (vendorId === 'retroVault' && offerings.retroVault) {
      result.push(box.id);
    } else if (vendorId === 'broker' && offerings.broker) {
      result.push(box.id);
    }
  }
  return result;
}

/**
 * Rolls the contents of a box. Returns an array of setIds. Weighted
 * draw is intentionally bland — the gamble lives in *which* sets get
 * drawn, while the simulated pack contents inside still respect the
 * untouched pull rate engine.
 */
export function rollBoxContents(boxId) {
  const box = MYSTERY_BOXES[boxId];
  if (!box) return [];
  const total = box.weights.reduce((a, b) => a + b, 0);
  const draws = [];
  for (let i = 0; i < box.packCount; i++) {
    let r = Math.random() * total;
    let chosen = box.pool[0];
    for (let j = 0; j < box.pool.length; j++) {
      r -= box.weights[j];
      if (r <= 0) { chosen = box.pool[j]; break; }
    }
    draws.push(chosen);
  }
  return draws;
}

/** Sum of base PACK_STORE prices for the rolled set list — used for "value" hint. */
export function calculateBoxFairValue(setIds) {
  return setIds.reduce((sum, id) => sum + (PACK_STORE[id]?.price || 0), 0);
}

export function getBoxById(boxId) { return MYSTERY_BOXES[boxId] || null; }
