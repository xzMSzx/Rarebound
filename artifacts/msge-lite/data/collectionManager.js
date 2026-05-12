/**
 * data/collectionManager.js — Phase 9 / v1.2.1
 *
 * v2 collection storage. Cards are keyed by set then card ID, with a
 * duplicate count, an auto-lock flag, and an optional reverseHolo count.
 *
 * Shape:
 *   {
 *     [setId]: {
 *       [cardId]: { count: number, locked: boolean, reverseHolo?: number }
 *     }
 *   }
 *
 * A missing `locked` field is treated as `true` for backward compatibility
 * with Phase 7/8 saves. `reverseHolo` is absent on pre-v1.2.1 saves (treat as 0).
 */

const STORAGE_KEY = 'tcg_collection_v2';

export function getCollection() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

export function saveCollection(collection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

/**
 * Increments the count for a card. First add auto-locks the card.
 * v1.2.1: if card.isReverseHolo is true, increments the reverseHolo variant count.
 */
export function addCardToCollection(card) {
  const { setId, id: cardId, isReverseHolo } = card;
  if (!setId || !cardId) return;

  const collection = getCollection();
  if (!collection[setId])         collection[setId] = {};
  if (!collection[setId][cardId]) collection[setId][cardId] = { count: 0, locked: true };

  collection[setId][cardId].count += 1;
  if (isReverseHolo) {
    collection[setId][cardId].reverseHolo = (collection[setId][cardId].reverseHolo || 0) + 1;
  }
  saveCollection(collection);
}

export function getOwnedEntry(setId, cardId) {
  return getCollection()[setId]?.[cardId] ?? null;
}

/** True if the entry exists and is locked (defaults to locked if undefined). */
export function isLocked(setId, cardId) {
  const entry = getOwnedEntry(setId, cardId);
  if (!entry) return false;
  return entry.locked !== false;
}

export function unlockCard(setId, cardId) {
  const collection = getCollection();
  if (collection[setId]?.[cardId]) {
    collection[setId][cardId].locked = false;
    saveCollection(collection);
  }
}

export function lockCard(setId, cardId) {
  const collection = getCollection();
  if (collection[setId]?.[cardId]) {
    collection[setId][cardId].locked = true;
    saveCollection(collection);
  }
}

/**
 * Decrements card count by 1. Removes the entry entirely if count hits 0.
 * Returns the new count (0 if entry was removed).
 */
export function decrementCard(setId, cardId) {
  const collection = getCollection();
  const entry      = collection[setId]?.[cardId];
  if (!entry) return 0;
  entry.count -= 1;
  if (entry.count <= 0) {
    delete collection[setId][cardId];
    if (Object.keys(collection[setId]).length === 0) delete collection[setId];
    saveCollection(collection);
    return 0;
  }
  saveCollection(collection);
  return entry.count;
}

export function clearCollection() {
  localStorage.removeItem(STORAGE_KEY);
}
