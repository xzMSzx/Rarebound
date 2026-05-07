/**
 * data/collectionStore.js — Phase 6.5
 *
 * Persistent flat collection of every card ever pulled from a pack.
 * Cards are stored as plain objects with name, imageUrl, rarityType, setId.
 * Multiple copies of the same card are stored as separate entries so the
 * collection grid shows every pull in order.
 */

const COLLECTION_KEY = 'tcg_collection_v1';

/**
 * Returns the full ordered list of pulled cards.
 * @returns {Object[]}
 */
export function getCollection() {
  try {
    return JSON.parse(localStorage.getItem(COLLECTION_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Appends cards from the latest pack to the persistent collection.
 * @param {Object[]} cards — augmented card objects from main.js
 */
export function addToCollection(cards) {
  const current = getCollection();
  const toSave = cards.map((c) => ({
    id:         c.id,
    name:       c.name       || 'Unknown',
    imageUrl:   c.imageUrl   || '',
    rarityType: c.rarityType || c.rarity || 'common',
  }));
  localStorage.setItem(COLLECTION_KEY, JSON.stringify([...current, ...toSave]));
}

/**
 * Wipes the collection (debug / reset helper).
 */
export function clearCollection() {
  localStorage.removeItem(COLLECTION_KEY);
}
