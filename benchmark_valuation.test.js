import { describe, it, vi } from 'vitest';
import { computeTotalCollectionValue } from './data/collectionValuation.js';
import * as ags from './data/agsSubmissionManager.js';

// Setup localStorage mock to avoid errors
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

describe('benchmark', () => {
  it('runs', () => {
    const dummyMapPokemonRarity = () => 'common';
    const dummyGetMarketValue = () => 1;

    const fakeCtx = {
      getCachedSetCards: (setId) => {
        return Array(100).fill(0).map((_, i) => ({ id: `card-${i}`, rarity: 'common' }));
      },
      allValues: {},
      getMarketValue: dummyGetMarketValue,
      mapPokemonRarity: dummyMapPokemonRarity
    };

    const dummyCollection = {};
    for (let s = 0; s < 10; s++) {
      const setKey = `set-${s}`;
      dummyCollection[setKey] = {};
      for (let c = 0; c < 100; c++) {
        dummyCollection[setKey][`card-${c}`] = { count: 2 };
      }
    }

    // add some dummy AGS data
    vi.spyOn(ags, 'lockedCopiesFor').mockImplementation(() => 0);
    vi.spyOn(ags, 'getSlabsForCard').mockImplementation(() => []);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      computeTotalCollectionValue(dummyCollection, fakeCtx);
    }
    const end = performance.now();
    console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
  });
});
