/**
 * data/setRegistry.js
 * Single source of truth for all set IDs across the system.
 *
 * Phase 5.0: Centralised registry to prevent ID mismatch bugs (the kind that
 * caused Evolving Skies to silently fail when its tile shipped `data-set-id="evs"`
 * but the API ID was `swsh7`). Tiles, probability tables, and the loader all
 * key off the same registry slug.
 *
 * Each entry's `apiId` is the official Pokémon TCG API set identifier
 * (https://api.pokemontcg.io/v2/sets). Adding a new set requires a single
 * entry here plus its probability table in setProbabilityTables.js.
 */

export const SET_REGISTRY = {
  swsh7: {
    name:  'Evolving Skies',
    apiId: 'swsh7',
  },
  sv3pt5: {
    name:  'Scarlet & Violet 151',
    apiId: 'sv3pt5',
  },
  sv4pt5: {
    name:  'Paldean Fates',
    apiId: 'sv4pt5',
  },
  sv2: {
    name:  'Paldea Evolved',
    apiId: 'sv2',
  },
  swsh11: {
    name:  'Lost Origin',
    apiId: 'swsh11',
  },
};

/**
 * Resolve a registry slug to its API set ID.
 * Falls back to the slug itself when not registered (preserves direct API IDs).
 *
 * @param {string} slug
 * @returns {string}
 */
export function getApiId(slug) {
  return SET_REGISTRY[slug]?.apiId ?? slug;
}
