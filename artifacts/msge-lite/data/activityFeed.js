/**
 * data/activityFeed.js — v1.2.1
 *
 * Rolling in-app activity log. Records key player actions and renders
 * as a compact "World Activity" feed at the bottom of the Vendor Hub.
 *
 * Storage: tcg_activity → Array<{ type, label, ts }>
 * Max entries: 20 (oldest purged automatically).
 */

const STORAGE_KEY = 'tcg_activity';
const MAX_EVENTS  = 30;

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/**
 * Append an event to the feed.
 * @param {'pack_opened'|'stipend_claimed'|'request_fulfilled'|'broker_purchase'|'milestone'|'market_refresh'|'broker_arrived'|'prestige_pull'|'wishlist_hit'|'vendor_event'|'archive_event'|'reverse_holo_complete'|'recovery_survived'|'prestige_tier_up'|'ags_submitted'|'ags_complete'|'ags_pristine'|'ags_black_label'|'archive_record'} type
 * @param {string} label  Human-readable line of text shown in the feed.
 */
export function logActivity(type, label) {
  const events = load();
  events.unshift({ type, label, ts: Date.now() });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  save(events);
}

/**
 * Returns the most-recent `limit` events (default 7).
 * @param {number} limit
 * @returns {Array<{ type: string, label: string, ts: number }>}
 */
export function getActivityFeed(limit = 7) {
  return load().slice(0, limit);
}

export function clearActivityFeed() {
  localStorage.removeItem(STORAGE_KEY);
}
