/**
 * data/favoritesManager.js — v1.5.1
 *
 * Favorite-card persistence. Mirrors wishlistManager: a Set of card IDs
 * persisted as a JSON array under `tcg_favorites`.
 *
 * Favorites are pure collector identity — they do not gate gameplay,
 * never grant currency, never grant prestige. They only matter to the
 * player's emotional ownership of the archive.
 *
 * Designed to outlive surfacing changes — slabs, binders, and showcase
 * galleries can all derive from the same Set.
 *
 * Storage key: tcg_favorites  →  string[] (serialised Set)
 */

const STORAGE_KEY = 'tcg_favorites';

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []); }
  catch { return new Set(); }
}

function save(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

/** Full favorites as a Set of card IDs. */
export function getFavorites() { return load(); }

/** Number of favorited cards. */
export function getFavoriteCount() { return load().size; }

/** True if the card is favorited. */
export function isFavorited(cardId) { return load().has(cardId); }

/** Add a card to favorites. */
export function addFavorite(cardId) {
  const s = load(); s.add(cardId); save(s);
}

/** Remove a card from favorites. */
export function removeFavorite(cardId) {
  const s = load(); s.delete(cardId); save(s);
}

/**
 * Toggle favorite membership.
 * @param {string} cardId
 * @returns {boolean} true if now favorited, false if removed
 */
export function toggleFavorite(cardId) {
  const s = load();
  if (s.has(cardId)) { s.delete(cardId); } else { s.add(cardId); }
  save(s);
  return s.has(cardId);
}
