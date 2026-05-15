import * as profileStorage from './profileStorage.js';
/**
 * data/marketHistory.js — Phase 9.8
 *
 * Per-card rolling history of market values. Appended to on every economy
 * refresh tick (via marketValue.tickMarketValues). Bounded to MAX_POINTS
 * entries per card so the localStorage payload stays small even after
 * months of play.
 *
 * Storage:  tcg_market_history → { [cardId]: [{ t: timestamp, v: value }] }
 */

const STORAGE_KEY = 'tcg_market_history';
const MAX_POINTS  = 30;

let _cache = null;

function load()  {
  if (_cache) return _cache;
  try {
    _cache = JSON.parse(profileStorage.getItem(STORAGE_KEY)) || {};
    return _cache;
  } catch {
    _cache = {};
    return _cache;
  }
}

function save(h) {
  _cache = h;
  profileStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

/** Wipes all market history from both cache and profileStorage. */
export function clearHistory() {
  _cache = {};
  profileStorage.removeItem(STORAGE_KEY);
}

/** Append a new value point for a card. Trims to MAX_POINTS. */
export function appendHistory(cardId, value) {
  if (!cardId || value == null) return;
  const h = load();
  const arr = h[cardId] || [];
  arr.push({ t: Date.now(), v: +value.toFixed(2) });
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
  h[cardId] = arr;
  save(h);
}

/** Bulk version: write many cards at once (one profileStorage write). */
export function bulkAppendHistory(entries) {
  if (!entries || entries.length === 0) return;
  const h  = load();
  const ts = Date.now();
  for (const { cardId, value } of entries) {
    if (!cardId || value == null) continue;
    const arr = h[cardId] || [];
    arr.push({ t: ts, v: +value.toFixed(2) });
    if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
    h[cardId] = arr;
  }
  save(h);
}

/** Snapshot the entire history map. Useful for batch UI renders that
 *  would otherwise re-parse profileStorage once per row. */
export function getAllHistory() { return load(); }

// ─── Seeding ─────────────────────────────────────────────────────────────────

/** Per-tier max jitter (±fraction) for realistic seed variance. */
const SEED_VOL = {
  common: 0.01, uncommon: 0.012, rare: 0.015, holoRare: 0.018,
  doubleRare: 0.025, illustrationRare: 0.035, ultraRare: 0.04,
  specialIllustrationRare: 0.05, hyperRare: 0.065,
};

/**
 * Generate and persist 3–5 seed points ending at `baseValue` for a card
 * that has no prior history. Timestamps are spaced ~6 h apart.
 * Safe to call repeatedly — bails out immediately if history already exists.
 */
export function seedInitialHistory(cardId, baseValue, tier = 'common') {
  if (!cardId || baseValue == null) return;
  const h = load();
  if (h[cardId]?.length) return;

  const vol   = SEED_VOL[tier] ?? 0.02;
  const count = 3 + Math.floor(Math.random() * 3); // 3–5 points
  const now   = Date.now();
  const pts   = [];

  let val = +baseValue.toFixed(2);
  // Walk backwards from current value so the last point == baseValue.
  for (let i = count - 1; i >= 0; i--) {
    pts.unshift({ t: now - i * 6 * 3_600_000, v: val });
    if (i > 0) {
      const jitter = 1 + (Math.random() * 2 - 1) * vol;
      val = Math.max(0.01, +(val / jitter).toFixed(2));
    }
  }
  // Ensure final value matches exactly.
  pts[pts.length - 1].v = +baseValue.toFixed(2);

  h[cardId] = pts;
  save(h);
}

/**
 * Bulk-seed many cards at once (single profileStorage write).
 * Only seeds cards whose history array is empty or missing.
 * @param {Array<{cardId:string, value:number, tier:string}>} entries
 */
export function bulkSeedIfEmpty(entries) {
  if (!entries?.length) return;
  const h   = load();
  let dirty = false;

  for (const { cardId, value, tier = 'common' } of entries) {
    if (!cardId || value == null || h[cardId]?.length) continue;

    const vol   = SEED_VOL[tier] ?? 0.02;
    const count = 3 + Math.floor(Math.random() * 3);
    const now   = Date.now();
    const pts   = [];

    let val = +value.toFixed(2);
    for (let i = count - 1; i >= 0; i--) {
      pts.unshift({ t: now - i * 6 * 3_600_000, v: val });
      if (i > 0) {
        const jitter = 1 + (Math.random() * 2 - 1) * vol;
        val = Math.max(0.01, +(val / jitter).toFixed(2));
      }
    }
    pts[pts.length - 1].v = +value.toFixed(2);
    h[cardId] = pts;
    dirty = true;
  }

  if (dirty) save(h);
}

export function getHistory(cardId) {
  return load()[cardId] || [];
}

/** Percent change from oldest → newest point. 0 if fewer than 2 points. */
export function getMovementPct(cardId) {
  const arr = getHistory(cardId);
  if (arr.length < 2) return 0;
  const first = arr[0].v, last = arr[arr.length - 1].v;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

/** Min / max across the history window. */
export function getRange(cardId) {
  const arr = getHistory(cardId);
  if (arr.length === 0) return { min: 0, max: 0 };
  let min = arr[0].v, max = arr[0].v;
  for (const p of arr) { if (p.v < min) min = p.v; if (p.v > max) max = p.v; }
  return { min, max };
}

/** Approx volatility = (max-min)/mean. */
export function getVolatility(cardId) {
  const arr = getHistory(cardId);
  if (arr.length < 2) return 0;
  const { min, max } = getRange(cardId);
  const mean = arr.reduce((s, p) => s + p.v, 0) / arr.length;
  return mean === 0 ? 0 : (max - min) / mean;
}
