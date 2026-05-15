/**
 * data/collectionValueHistory.js — v1.7.0
 *
 * Chronological collection value samples for the Stats sparkline and
 * lifetime peak tracking. Points are appended when value moves materially,
 * on UTC day rollover, or on a long interval heartbeat — so dips (AGS
 * locks, market drift) appear in history, not only monotonic day-end peaks.
 *
 * Storage: tcg_value_history
 *   {
 *     points: Array<{ day: string, value: number, ts: number }>,
 *     lifetimePeak: number,
 *     lifetimePeakAt: number,
 *   }
 *
 * v1.4.0 stored at most one sample per UTC day (overwrite). v1.7.0 migrates
 * loaded saves and then maintains up to MAX_POINTS chronological samples.
 */

import { getCollection } from './collectionManager.js';
import { getCachedSetCards } from './cardPoolManager.js';
import { getMarketValue, getAllMarketValues } from './marketValue.js';
import { mapPokemonRarity } from './rarityMapper.js';
import { computeTotalCollectionValue } from './collectionValuation.js';

const STORAGE_KEY = 'tcg_value_history';
const MAX_POINTS  = 200;

/** Minimum time between stored samples unless value jumps materially. */
const MIN_SAMPLE_GAP_MS = 90_000;

/** $ or relative move that always creates a new sample. */
function materialMove(prevVal, nextVal) {
  const a = Math.abs(nextVal - prevVal);
  return a >= 0.02 || a >= Math.max(1, prevVal * 0.0005);
}

function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function coerceTs(p) {
  if (Number.isFinite(p.ts) && p.ts > 0) return p.ts;
  if (p.day && typeof p.day === 'string') {
    const t = Date.parse(`${p.day}T12:00:00Z`);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Array.isArray(raw.points)) {
      const points = raw.points.map((p) => ({
        day:  typeof p.day === 'string' ? p.day : todayKey(),
        value: typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : 0,
        ts: coerceTs(p),
      })).sort((a, b) => a.ts - b.ts);
      return {
        points,
        lifetimePeak:   typeof raw.lifetimePeak   === 'number' ? raw.lifetimePeak   : 0,
        lifetimePeakAt: typeof raw.lifetimePeakAt === 'number' ? raw.lifetimePeakAt : 0,
      };
    }
  } catch {}
  return { points: [], lifetimePeak: 0, lifetimePeakAt: 0 };
}

function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

/**
 * Record a new value sample when it changes the economic story materially,
 * crosses a UTC day, or enough time passed for a heartbeat sample.
 * @param {number} value
 * @returns {{ today:number, peak:number, prevDay:number|null, delta:number }}
 */
export function recordValueSnapshot(value) {
  if (!Number.isFinite(value) || value < 0) value = 0;
  const state = load();
  const ts    = Date.now();
  const day   = todayKey();

  const last = state.points.length ? state.points[state.points.length - 1] : null;

  let append = false;
  if (!last) {
    append = true;
  } else if (last.day !== day) {
    append = true;
  } else if (materialMove(last.value, value)) {
    append = true;
  } else if (ts - last.ts >= 6 * 3600 * 1000) {
    append = true;
  } else if (ts - last.ts >= MIN_SAMPLE_GAP_MS && Math.abs(value - last.value) >= 0.005) {
    append = true;
  }

  if (append) {
    state.points.push({ day, value, ts });
    if (state.points.length > MAX_POINTS) {
      state.points.splice(0, state.points.length - MAX_POINTS);
    }
  } else if (last) {
    last.value = value;
    last.ts    = ts;
    last.day   = day;
  }

  if (value > state.lifetimePeak) {
    state.lifetimePeak   = value;
    state.lifetimePeakAt = ts;
  }

  save(state);

  const points  = state.points;
  const today   = value;
  const prevPt  = points.length >= 2 ? points[points.length - 2] : null;
  const prevDay = prevPt ? prevPt.value : null;
  const delta   = prevDay === null ? today : today - prevDay;
  return { today, peak: state.lifetimePeak, prevDay, delta };
}

/**
 * Compute live portfolio value from the collection + AGS rules, then persist
 * a chronological snapshot. Safe to call from UI modules (AGS, ticks).
 */
export function recordChronologicalCollectionSnapshot() {
  const collection = getCollection();
  const allValues  = getAllMarketValues();
  const totalValue = computeTotalCollectionValue(collection, {
    getCachedSetCards,
    allValues,
    getMarketValue,
    mapPokemonRarity,
  });
  return recordValueSnapshot(totalValue);
}

/** All snapshot points (oldest → newest). */
export function getValueHistory() {
  return load().points.slice();
}

/** Lifetime peak value + timestamp. */
export function getLifetimePeak() {
  const s = load();
  return { peak: s.lifetimePeak, peakAt: s.lifetimePeakAt };
}

/** Convenience: latest sample value, peak, delta vs previous sample, points. */
export function getValueSummary() {
  const s = load();
  const points = s.points;
  if (points.length === 0) {
    return { today: 0, peak: s.lifetimePeak, prevDay: null, delta: 0, points: [] };
  }
  const today   = points[points.length - 1].value;
  const prevDay = points.length >= 2 ? points[points.length - 2].value : null;
  const delta   = prevDay === null ? today : today - prevDay;
  return { today, peak: s.lifetimePeak, prevDay, delta, points };
}

export function clearValueHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
