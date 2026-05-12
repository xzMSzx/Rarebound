/**
 * data/statsManager.js — Phase 11 (v1.2.0)
 *
 * Centralized player statistics store. Replaces the inline STATS_KEY
 * snippets scattered in main.js. All milestone-trackable actions flow
 * through this module so milestoneManager can query a single source of
 * truth without coupling to the DOM or specific event sites.
 *
 * Storage key: tcg_stats
 *   {
 *     packsOpened:        number,   // total packs opened (existed pre-v1.2)
 *     duplicatesSold:     number,   // duplicate cards surrendered to vendors
 *     requestsCompleted:  number,   // vendor requests fulfilled
 *     lifetimeRevenue:    number,   // USD earned from sells + request rewards
 *     brokerPurchases:    number,   // cards acquired from the Broker
 *     distressEver:       boolean,  // player has ever hit the distress threshold
 *     distressRecovered:  boolean,  // player has recovered from distress
 *   }
 */

const STORAGE_KEY = 'tcg_stats';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

/** Read any stat, returning `fallback` if not yet recorded. */
export function getStat(key, fallback = 0) {
  const v = load()[key];
  return v === undefined ? fallback : v;
}

/** Increment a numeric stat by `by` (default 1). Returns new value. */
export function incrementStat(key, by = 1) {
  const s  = load();
  s[key]   = (typeof s[key] === 'number' ? s[key] : 0) + by;
  save(s);
  return s[key];
}

/** Set a stat to an explicit value (use for booleans / one-time flags). */
export function setStat(key, value) {
  const s  = load();
  s[key]   = value;
  save(s);
}

// ─── Named shortcuts (type-safe by convention) ────────────────────────────────

export function getPacksOpened() { return getStat('packsOpened', 0); }
export function incrementPacksOpened() { return incrementStat('packsOpened'); }

export function getDuplicatesSold() { return getStat('duplicatesSold', 0); }
export function incrementDuplicatesSold() { return incrementStat('duplicatesSold'); }

export function getRequestsCompleted() { return getStat('requestsCompleted', 0); }
export function incrementRequestsCompleted() { return incrementStat('requestsCompleted'); }

export function getLifetimeRevenue() { return getStat('lifetimeRevenue', 0); }
export function addLifetimeRevenue(amount) { return incrementStat('lifetimeRevenue', amount); }

export function getBrokerPurchases() { return getStat('brokerPurchases', 0); }
export function incrementBrokerPurchases() { return incrementStat('brokerPurchases'); }

/** Called when balance transitions from below $8 to above (recovery). */
export function recordDistressRecovery() {
  if (getStat('distressRecovered', false)) return;
  setStat('distressRecovered', true);
}

/** Mark that the player has entered the distress zone. */
export function recordDistressEntry() {
  if (!getStat('distressEver', false)) setStat('distressEver', true);
}

export function hasDistressRecovered() { return getStat('distressRecovered', false) === true; }
export function wasEverDistressed()    { return getStat('distressEver',      false) === true; }

/** Dev tool — wipe stats for a fresh run. */
export function clearStats() { localStorage.removeItem(STORAGE_KEY); }
