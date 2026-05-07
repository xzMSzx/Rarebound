/**
 * data/wishlistManager.js — Phase 8
 *
 * Wishlist / chase-card persistence.
 * Stores a Set of card IDs the user has starred.
 *
 * Storage key: tcg_wishlist  →  string[] (serialised Set)
 */

const STORAGE_KEY = 'tcg_wishlist';

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []); }
  catch { return new Set(); }
}

function save(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

/** Full wishlist as a Set of card IDs. */
export function getWishlist() { return load(); }

/** True if the card is on the wishlist. */
export function isWishlisted(cardId) { return load().has(cardId); }

/** Add a card to the wishlist. */
export function addToWishlist(cardId) {
  const s = load(); s.add(cardId); save(s);
}

/** Remove a card from the wishlist. */
export function removeFromWishlist(cardId) {
  const s = load(); s.delete(cardId); save(s);
}

/**
 * Toggle wishlist membership.
 * @param {string} cardId
 * @returns {boolean} true if now wishlisted, false if removed
 */
export function toggleWishlist(cardId) {
  const s = load();
  if (s.has(cardId)) { s.delete(cardId); } else { s.add(cardId); }
  save(s);
  return s.has(cardId);
}
