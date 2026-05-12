/**
 * data/archiveHistoryManager.js — v1.4.0
 *
 * "Archive History" — a private, prestigious chronological log of the
 * player's most personally meaningful collection events. Distinct from
 * the rolling activity feed: archive history is permanent, deduplicated
 * by event-key for first-of-a-kind events, and styled like a
 * collector's private archive log rather than a social feed.
 *
 * Storage:
 *   tcg_archive_history → { day0: number, entries: HistoryEntry[] }
 *   HistoryEntry = { ts, day, type, key?, label, meta? }
 *
 * `day0` is the first time this save touched archive history. All
 * entries record `day` = days since day0 (player day count). On a
 * fresh save, day0 = first record's timestamp midnight.
 *
 * `key` is optional — used for first-of-a-kind events (first
 * illustration rare, first hyper rare, first set complete) so they
 * are recorded only once even if the trigger fires repeatedly.
 *
 * Cap: 200 entries (oldest pruned).
 */

const STORAGE_KEY = 'tcg_archive_history';
const MAX_ENTRIES = 200;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Array.isArray(raw.entries) && typeof raw.day0 === 'number') return raw;
  } catch {}
  return { day0: 0, entries: [] };
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function midnightOf(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

function dayCount(day0, ts) {
  if (!day0) return 1;
  return Math.max(1, Math.floor((midnightOf(ts) - day0) / 86400000) + 1);
}

/**
 * Record an archive history entry.
 *
 * @param {string}  type  One of: prestige_pull | wishlist_hit |
 *                        set_completed | recovery_survived |
 *                        broker_acquisition | reverse_holo_complete |
 *                        value_peak | milestone_major.
 * @param {string}  label Human-readable line (kept short, factual).
 * @param {object}  [opts]
 * @param {string}  [opts.key]  Optional first-of-a-kind key — duplicate
 *                              calls with the same key are no-ops.
 * @param {object}  [opts.meta] Optional extra payload.
 * @returns {object|null}       The entry written, or null if deduped.
 */
export function recordArchiveEvent(type, label, { key = null, meta = null } = {}) {
  if (!type || !label) return null;
  const state = load();
  const ts    = Date.now();

  if (!state.day0) state.day0 = midnightOf(ts);

  if (key) {
    const seen = state.entries.some(e => e.key === key);
    if (seen) return null;
  }

  const entry = {
    ts,
    day: dayCount(state.day0, ts),
    type,
    key: key || undefined,
    label,
    meta: meta || undefined,
  };
  state.entries.unshift(entry);
  if (state.entries.length > MAX_ENTRIES) state.entries.length = MAX_ENTRIES;
  save(state);
  return entry;
}

/** Has a first-of-a-kind event been recorded? */
export function hasArchiveKey(key) {
  if (!key) return false;
  return load().entries.some(e => e.key === key);
}

/** Returns most-recent N entries (default 6). */
export function getArchiveEntries(limit = 6) {
  return load().entries.slice(0, limit);
}

/** All entries (read-only). For the full archive view. */
export function getAllArchiveEntries() {
  return load().entries.slice();
}

export function getArchiveEntryCount() { return load().entries.length; }

export function clearArchiveHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
