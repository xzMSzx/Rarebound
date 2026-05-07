/**
 * data/recentHits.js — Phase 9.9
 *
 * Tracks the last few notable pulls (rare or better) for the home-screen
 * "Recent Hits" rail. Provides emotional continuity across sessions.
 *
 * Storage:  tcg_recent_hits → [{ cardId, setId, rarity, name, imageUrl, ts }]
 */

const STORAGE_KEY = 'tcg_recent_hits';
const MAX_HITS    = 5;
const HIT_TIERS   = new Set([
  'rare','holoRare','doubleRare','illustrationRare',
  'ultraRare','specialIllustrationRare','hyperRare',
]);

function load()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function save(a) { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }

/**
 * Records a pulled card to the recent-hits list. No-op if rarity is below
 * the "rare" threshold. Most recent first.
 */
export function recordHit({ cardId, setId, rarity, name, imageUrl }) {
  if (!cardId || !HIT_TIERS.has(rarity)) return;
  const arr = load();
  // Avoid back-to-back duplicates of the exact same pull
  if (arr[0]?.cardId === cardId) return;
  arr.unshift({ cardId, setId, rarity, name, imageUrl, ts: Date.now() });
  if (arr.length > MAX_HITS) arr.length = MAX_HITS;
  save(arr);
}

export function getRecentHits() { return load(); }
