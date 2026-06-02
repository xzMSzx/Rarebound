/**
 * data/cardPoolManager.js
 * Loads, caches, and pools Pokémon cards grouped by real rarity category.
 *
 * Phase 4.3: Updated pool structure to match authentic Pokémon TCG rarity tiers.
 * The engine's RNG, pity system, and slot probabilities are never touched here.
 * This module only supplies artwork + name to attach to engine-generated cards.
 */

import { fetchSetCards } from './setLoader.js';
import { normalizeCardData } from './cardDataNormalizer.js';
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
const poolCache = {};
const inFlightLoads = {};

/**
 * Full raw API card list, keyed by setId — used by the binder to display
 * every card in a set (owned + unowned) without re-fetching.
 * @type {Object.<string, Object[]>}
 */
const rawSetCache = {};

const CACHE_PREFIX = 'rb_set_hd_v2_';
const LEGACY_CACHE_PREFIXES = ['rb_set_', 'rb_set_hd_'];

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
  cleanupLegacySetCaches();

  if (poolCache[setId]) {
    currentSetId = setId;
    cachedCards = poolCache[setId];
    return cachedCards;
  }

  const persistent = readPersistentSet(setId);
  if (persistent) {
    currentSetId = setId;
    cachedCards = persistent.pools;
    poolCache[setId] = persistent.pools;
    rawSetCache[setId] = persistent.raw;
    return cachedCards;
  }

  if (inFlightLoads[setId]) return inFlightLoads[setId];

  inFlightLoads[setId] = (async () => {
    const apiCards = normalizeCardData(await fetchSetCards(setId));
    const pools = buildPools(apiCards);

    rawSetCache[setId] = apiCards;
    poolCache[setId] = pools;
    currentSetId = setId;
    cachedCards = pools;
    writePersistentSet(setId, { pools, raw: apiCards });
    return pools;
  })().finally(() => {
    delete inFlightLoads[setId];
  });

  return inFlightLoads[setId];
}

function buildPools(apiCards) {
  if (!Array.isArray(apiCards) || apiCards.length === 0) {
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
      apiRarity: card.rarity,
      set:      card.set,
      // Prioritise high-res image
      imageUrl: card.images.large || card.images.small,
    });
  }

  // Auto-fill fallbacks
  function formatCard(apiCard, forcedRarity) {
    return {
      name:     apiCard.name,
      rarity:   forcedRarity,
      apiRarity: apiCard.rarity,
      set:      apiCard.set,
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

  return pools;
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

function cacheKeyFor(setId) {
  return `${CACHE_PREFIX}${setId}`;
}

function readPersistentSet(setId) {
  if (typeof localStorage === 'undefined') return null;
  const cacheKey = cacheKeyFor(setId);
  const savedData = localStorage.getItem(cacheKey);
  if (!savedData) return null;

  try {
    const parsed = JSON.parse(savedData);
    const raw = normalizeCardData(parsed?.raw);
    if (!parsed?.pools || raw.length === 0) throw new Error('cache payload incomplete');
    const pools = normalizePools(parsed.pools);
    return { pools, raw };
  } catch (e) {
    console.warn(`[cardPoolManager] Cache corrupted for ${setId}; clearing entry.`);
    try { localStorage.removeItem(cacheKey); } catch {}
    return null;
  }
}

function writePersistentSet(setId, payload) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(cacheKeyFor(setId), JSON.stringify(payload));
  } catch (e) {
    console.warn(`[cardPoolManager] Storage full; could not cache ${setId}.`);
    pruneSetCachesExcept(setId);
    try { localStorage.setItem(cacheKeyFor(setId), JSON.stringify(payload)); } catch {}
  }
}

function normalizePools(pools) {
  const normalized = {};
  for (const tier of ALL_TIERS) {
    normalized[tier] = Array.isArray(pools?.[tier]) ? pools[tier].map((card) => ({
      ...card,
      imageUrl: card.imageUrl || card.images?.hires || card.images?.large || card.images?.small || '',
    })) : [];
  }
  return normalized;
}

let _legacyCleanupDone = false;
function cleanupLegacySetCaches() {
  if (_legacyCleanupDone || typeof localStorage === 'undefined') return;
  _legacyCleanupDone = true;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && !key.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn('[cardPoolManager] Legacy cache cleanup skipped:', e.message);
  }
}

function pruneSetCachesExcept(activeSetId) {
  try {
    const activeKey = cacheKeyFor(activeSetId);
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) && key !== activeKey) keys.push(key);
    }
    keys.slice(0, Math.ceil(keys.length / 2)).forEach((key) => localStorage.removeItem(key));
  } catch {}
}
