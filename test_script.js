global.localStorage = {
  getItem: () => null,
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
