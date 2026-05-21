/**
 * data/collectionValuation.js
 *
 * Single authoritative collection line valuation: raw surplus (not AGS-locked)
 * times unit raw price, plus each completed slab's graded value. Does not
 * double-count locked/raw with slabs — uses lockedCopiesFor from AGS state.
 */

import { lockedCopiesFor, getSlabsForCard } from './agsSubmissionManager.js';
import { gradedValueFromRaw } from './agsMarketIntegration.js';

/**
 * @param {string} setId
 * @param {string} cardId
 * @param {{ count?: number }} entry
 * @param {{
 *   getCachedSetCards: (setId: string) => unknown[] | null | undefined,
 *   allValues: Record<string, number>,
 *   getMarketValue: (cardId: string, tier: string) => number,
 *   mapPokemonRarity: (rarity: string | undefined) => string,
 * }} ctx
 */
export function lineValueForCollectionEntry(setId, cardId, entry, ctx) {
  const cached = ctx.getCachedSetCards(setId) || [];

  if (!ctx._apiCardMapCache) {
    ctx._apiCardMapCache = new Map();
  }
  let setMap = ctx._apiCardMapCache.get(setId);
  if (!setMap) {
    setMap = new Map();
    for (let i = 0; i < cached.length; i++) {
      setMap.set(cached[i].id, cached[i]);
    }
    ctx._apiCardMapCache.set(setId, setMap);
  }

  const apiCard = setMap.get(cardId);
  const tier = apiCard ? ctx.mapPokemonRarity(apiCard.rarity) : 'common';
  const rawUnit = ctx.allValues[cardId] ?? ctx.getMarketValue(cardId, tier);

  const count = Math.max(0, Number(entry?.count) || 0);
  const locked = lockedCopiesFor(setId, cardId);
  const rawCopies = Math.max(0, count - locked);

  let sum = rawCopies * rawUnit;
  for (const slab of getSlabsForCard(setId, cardId)) {
    sum += gradedValueFromRaw(rawUnit, slab.grade);
  }
  return Math.round(sum * 100) / 100;
}

/**
 * @param {Record<string, Record<string, { count?: number }>>} collection
 * @param {*} ctx — same shape as lineValueForCollectionEntry
 */
export function computeTotalCollectionValue(collection, ctx) {
  let total = 0;
  try {
    for (const [setId, cards] of Object.entries(collection || {})) {
      for (const [cardId, entry] of Object.entries(cards || {})) {
        total += lineValueForCollectionEntry(setId, cardId, entry, ctx);
      }
    }
  } finally {
    // Clear operation-scoped cache to avoid state desync in tests
    ctx._apiCardMapCache = undefined;
  }
  return Math.round(total * 100) / 100;
}
