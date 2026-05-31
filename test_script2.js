global.localStorage = {
  getItem: () => JSON.stringify({
    set1: {
      card1: { count: 1, locked: true },
      card2: { count: 2, locked: true },
      card3: { count: 3, locked: true },
      card4: { count: 4, locked: true },
      card5: { count: 5, locked: true },
      card6: { count: 6, locked: true },
      card7: { count: 7, locked: true },
      card8: { count: 8, locked: true },
      card9: { count: 9, locked: true },
      card10: { count: 10, locked: true },
    }
  }),
  setItem: () => {},
  removeItem: () => {},
  length: 0,
  key: () => null
};
import('./artifacts/msge-lite/data/collectionManager.js').then(module => {
  const getCollection = module.getCollection;
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    getCollection();
  }
  console.log('Time:', performance.now() - start);
});
