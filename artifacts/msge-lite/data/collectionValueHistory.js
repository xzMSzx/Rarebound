/**
 * data/collectionValueHistory.js — v1.4.0
 *
 * Tracks the player's collection value over time. One snapshot per
 * UTC day (the day's last-recorded value wins). Lightweight — capped
 * at 90 days (~3 months) so the localStorage footprint stays small.
 *
 * Also records:
 *   - lifetimePeak: highest snapshot ever recorded
 *   - lifetimePeakAt: timestamp of the peak
 *
 * Storage: tcg_value_history
 *   {
 *     points: Array<{ day: 'YYYY-MM-DD', value: number, ts: number }>,
 *     lifetimePeak: number,
 *     lifetimePeakAt: number,
 *   }
 *
 * Caller is responsible for computing the current collection value
 * and passing it to `recordValueSnapshot()`. This module is purely
 * the persistence + derived-stats layer.
 */

const STORAGE_KEY = 'tcg_value_history';
const MAX_POINTS  = 90;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Array.isArray(raw.points)) return {
      points: raw.points,
      lifetimePeak:   typeof raw.lifetimePeak   === 'number' ? raw.lifetimePeak   : 0,
      lifetimePeakAt: typeof raw.lifetimePeakAt === 'number' ? raw.lifetimePeakAt : 0,
    };
  } catch {}
  return { points: [], lifetimePeak: 0, lifetimePeakAt: 0 };
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Record (or overwrite) today's snapshot.
 * @param {number} value
 * @returns {{ today:number, peak:number, prevDay:number|null, delta:number }}
 */
export function recordValueSnapshot(value) {
  if (!Number.isFinite(value) || value < 0) value = 0;
  const state = load();
  const day   = todayKey();
  const ts    = Date.now();

  // Replace if today already has a snapshot, else append
  const lastIdx = state.points.length - 1;
  if (lastIdx >= 0 && state.points[lastIdx].day === day) {
    state.points[lastIdx] = { day, value, ts };
  } else {
    state.points.push({ day, value, ts });
    if (state.points.length > MAX_POINTS) state.points.splice(0, state.points.length - MAX_POINTS);
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

/** All snapshot points (oldest → newest). */
export function getValueHistory() {
  return load().points.slice();
}

/** Lifetime peak value + timestamp. */
export function getLifetimePeak() {
  const s = load();
  return { peak: s.lifetimePeak, peakAt: s.lifetimePeakAt };
}

/** Convenience: today value, peak, and 24h delta. */
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
