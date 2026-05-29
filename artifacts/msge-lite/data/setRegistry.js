/**
 * data/setRegistry.js
 * Single source of truth for all set IDs across the system.
 *
 * Tiles, probability tables, and the loader all key off the same registry
 * slug. `apiId` is now the static pokemon-tcg-data JSON filename, so aliases
 * can still resolve to the canonical file.
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
  sv6: {
    name:  'Twilight Masquerade',
    apiId: 'sv6',
  },
  sv7: {
    name:  'Stellar Crown',
    apiId: 'sv7',
  },
  sv8: {
    name:  'Surging Sparks',
    apiId: 'sv8',
  },
  sv8a: {
    name:  'Prismatic Evolutions',
    apiId: 'sv8pt5',
  },
  sv8pt5: {
    name:  'Prismatic Evolutions',
    apiId: 'sv8pt5',
  },
  sv9: {
    name:  'Journey Together',
    apiId: 'sv9',
  },
};

/**
 * Resolve a registry slug to its static data filename.
 * Falls back to the slug itself when not registered.
 *
 * @param {string} slug
 * @returns {string}
 */
export function getApiId(slug) {
  return SET_REGISTRY[slug]?.apiId ?? slug;
}

