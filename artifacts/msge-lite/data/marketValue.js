import { bulkAppendHistory } from './marketHistory.js';

/**
 * data/marketValue.js — Phase 8 + Phase 9 drift
 *
 * Procedural value engine. Phase 8 introduced deterministic seeded values;
 * Phase 9 adds slow drift on every refresh tick, bounded by per-rarity
 * volatility limits and biased by the active market trend.
 *
 * Storage:
 *   tcg_market_values  → { [cardId]: number }
 *   tcg_market_meta    → { [cardId]: { tier, lastDrift } }   // for drift
 */

const VALUE_KEY = 'tcg_market_values';
const META_KEY  = 'tcg_market_meta';

const VALUE_RANGES = {
  common:                  [0.05,   0.40],
  uncommon:                [0.10,   0.75],
  rare:                    [0.50,   4.00],
  holoRare:                [1.00,   8.00],
  doubleRare:              [5.00,  20.00],
  illustrationRare:        [15.00, 60.00],
  ultraRare:               [20.00, 80.00],
  specialIllustrationRare: [80.00, 300.00],
  hyperRare:               [120.00, 500.00],
};

// Per-rarity drift band per refresh cycle.
const VOLATILITY = {
  common: 0.01, uncommon: 0.015, rare: 0.03, holoRare: 0.03,
  doubleRare: 0.05, illustrationRare: 0.07, ultraRare: 0.07,
  specialIllustrationRare: 0.10, hyperRare: 0.10,
};

function hashFraction(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h / 0xffffffff;
}

function loadValues() { try { return JSON.parse(localStorage.getItem(VALUE_KEY)) || {}; } catch { return {}; } }
function saveValues(v) { localStorage.setItem(VALUE_KEY, JSON.stringify(v)); }
function loadMeta()   { try { return JSON.parse(localStorage.getItem(META_KEY))  || {}; } catch { return {}; } }
function saveMeta(m)  { localStorage.setItem(META_KEY,  JSON.stringify(m)); }

/** Persisted market value for a card. Generates + writes on first call. */
export function getMarketValue(cardId, rarityTier) {
  if (!cardId) return 0;
  const values = loadValues();
  if (values[cardId] != null) return values[cardId];

  const [min, max] = VALUE_RANGES[rarityTier] ?? VALUE_RANGES.common;
  const v = min + hashFraction(cardId) * (max - min);
  values[cardId] = +v.toFixed(2);
  saveValues(values);

  // Track tier so we can drift later
  const meta = loadMeta();
  meta[cardId] = { tier: rarityTier, lastDrift: Date.now(), ...(meta[cardId] || {}) };
  saveMeta(meta);

  return values[cardId];
}

/**
 * Enriches the per-card meta with type/set info so the trend system can
 * apply biases beyond rarity tiers. Safe to call multiple times — only writes
 * if new info is being added.
 */
export function enrichMarketMeta(cardId, { types, setId } = {}) {
  if (!cardId) return;
  const meta = loadMeta();
  const cur  = meta[cardId];
  if (!cur) return;   // value hasn't been generated yet; nothing to enrich
  let dirty = false;
  if (types && (!cur.types || cur.types.length === 0)) { cur.types = types; dirty = true; }
  if (setId && cur.setId !== setId) { cur.setId = setId; dirty = true; }
  if (dirty) { meta[cardId] = cur; saveMeta(meta); }
}

export function getAllMarketValues() { return loadValues(); }

/**
 * Drifts every persisted card value by a random walk within its volatility
 * band, clamped to its rarity range. Applies trend multiplier if the card
 * matches the trend's affected types/rarities/sets.
 *
 * Called by economyManager.runRefresh().
 */
export function tickMarketValues(trend) {
  const values = loadValues();
  const meta   = loadMeta();
  const ids    = Object.keys(values);
  if (ids.length === 0) return;

  for (const id of ids) {
    const tier = meta[id]?.tier;
    if (!tier) continue;
    const range  = VALUE_RANGES[tier] ?? VALUE_RANGES.common;
    const vol    = VOLATILITY[tier]   ?? 0.02;
    let bias     = 1;
    const m      = meta[id];
    if (trend?.rarities?.includes(tier))                            bias = trend.multiplier;
    if (trend?.types   && m?.types?.some(t => trend.types.includes(t)))  bias = trend.multiplier;
    if (trend?.sets    && m?.setId && trend.sets.includes(m.setId))     bias = trend.multiplier;
    const drift  = (Math.random() * 2 - 1) * vol;   // ±vol
    let next     = values[id] * (1 + drift) * bias;
    next         = Math.min(range[1], Math.max(range[0], next));
    values[id]   = +next.toFixed(2);
    meta[id].lastDrift = Date.now();
  }

  saveValues(values);
  saveMeta(meta);

  // Append a single point per card to the rolling history (Phase 9.8)
  bulkAppendHistory(ids.map(id => ({ cardId: id, value: values[id] })));
}
