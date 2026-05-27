/**
 * data/cardPoolManager.js
 * Loads, caches, and pools Pokémon cards grouped by real rarity category.
 *
 * Phase 4.3: Updated pool structure to match authentic Pokémon TCG rarity tiers.
 * The engine's RNG, pity system, and slot probabilities are never touched here.
 * This module only supplies artwork + name to attach to engine-generated cards.
 */

import { fetchSetCards }    from './setLoader.js';
import { mapPokemonRarity } from './rarityMapper.js';

/** @type {string|null} */
let currentSetId = null;

/**
 * Cards grouped by real Pokémon rarity category.
 * @type {{
 *   common: Object[], uncommon: Object[], rare: Object[],
 *   holoRare: Object[], doubleRare: Object[], illustrationRare: Object[],
 *   ultraRare: Object[], specialIllustrationRare: Object[], hyperRare: Object[]
 * }|null}
 */
let cachedCards = null;

/**
 * Full raw API card list, keyed by setId — used by the binder to display
 * every card in a set (owned + unowned) without re-fetching.
 * @type {Object.<string, Object[]>}
 */
const rawSetCache = {};

/** All rarity tiers in the new system, ordered from lowest to highest. */
const ALL_TIERS = [
  'common',
  'uncommon',
  'rare',
  'holoRare',
  'doubleRare',
  'illustrationRare',
  'ultraRare',
  'specialIllustrationRare',
  'hyperRare',
];

/**
 * Load a Pokémon TCG set into the card pool.
 * Returns the cached pool immediately if the same set is already loaded.
 *
 * @param {string} setId
 * @returns {Promise<Object>} pools keyed by rarity tier
 */
export async function loadSet(setId) {
  // 1. Check in-memory cache first
  if (setId === currentSetId && cachedCards) return cachedCards;

  // 2. Check persistent hard drive cache (Instant Loading)
  // Using a new cache key (_hd_) to force bypass of old blurry caches
  const cacheKey = `rb_set_hd_${setId}`; 
  const savedData = localStorage.getItem(cacheKey);
  
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      currentSetId = setId;
      cachedCards = parsed.pools;
      rawSetCache[setId] = parsed.raw;
      return cachedCards;
    } catch (e) {
      console.warn("Cache corrupted, re-fetching...");
    }
  }

  // 3. If not cached, fetch from API (using the new blazing fast &select url)
  const apiCards = await fetchSetCards(setId);
  rawSetCache[setId] = apiCards;

  if (apiCards.length === 0) {
    throw new Error('No cards passed into cardPoolManager');
  }

  const pools = {
    common: [], uncommon: [], rare: [], holoRare: [], doubleRare: [],
    illustrationRare: [], ultraRare: [], specialIllustrationRare: [], hyperRare: [],
  };

  for (const card of apiCards) {
    if (!card.images?.large && !card.images?.small) continue;

    const rarity = mapPokemonRarity(card.rarity);
    pools[rarity ?? 'common'].push({
      id:       card.id,
      name:     card.name,
      rarity:   rarity ?? 'common',
      // Prioritise high-res image
      imageUrl: card.images.large || card.images.small,
    });
  }

  // Auto-fill fallbacks
  function formatCard(apiCard, forcedRarity) {
    return {
      name:     apiCard.name,
      rarity:   forcedRarity,
      imageUrl: apiCard.images.large || apiCard.images.small,
    };
  }

  if (pools.common.length === 0) pools.common = apiCards.slice(0, 20).map((c) => formatCard(c, 'common'));
  if (pools.uncommon.length === 0) pools.uncommon = apiCards.slice(20, 40).map((c) => formatCard(c, 'uncommon'));
  if (pools.rare.length === 0) pools.rare = apiCards.slice(40, 60).map((c) => formatCard(c, 'rare'));

  // Borrow from lower tiers if a higher tier is empty
  for (let i = ALL_TIERS.length - 1; i >= 1; i--) {
    const tier = ALL_TIERS[i];
    if (pools[tier].length === 0) {
      for (let j = i - 1; j >= 0; j--) {
        const donor = ALL_TIERS[j];
        if (pools[donor].length > 0) {
          pools[tier] = pools[donor].slice(0, 10).map((c) => ({ ...c, rarity: tier }));
          break;
        }
      }
    }
  }

  // 4. Save the processed high-res pools to the hard drive cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ pools, raw: apiCards }));
  } catch (e) {
    console.warn("Storage full, could not cache set");
  }

  currentSetId = setId;
  cachedCards = pools;
  return cachedCards;
}

/**
 * Pick a uniformly random card from the given rarity pool.
 * Returns null when no set has been loaded yet or the pool is empty.
 *
 * @param {string} rarity  one of the nine real rarity categories
 * @returns {{ name: string, rarity: string, imageUrl: string }|null}
 */
export function getRandomCard(rarity) {
  if (!cachedCards) return null;
  const pool = cachedCards[rarity];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Returns true when a set has been successfully loaded and is ready to use.
 * @returns {boolean}
 */
/** Phase 5.7 — pack opening controller needs the active setId to choose
 *  the correct booster artwork. Read-only accessor; never mutates state. */
export function getCurrentSetId() {
  return currentSetId;
}

export function isSetLoaded() {
  return cachedCards !== null;
}

/**
 * Returns the full raw API card list for a set, or null if not yet loaded.
 * Used by the Phase 7 binder to show all cards (owned + unowned) without
 * making a new network request.
 *
 * @param {string} setId
 * @returns {Object[]|null}
 */
export function getCachedSetCards(setId) {
  return rawSetCache[setId] ?? null;
}
