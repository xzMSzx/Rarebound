import { getCollection } from './data/collectionManager.js';
import * as ps from './data/persistenceStore.js';

const start = performance.now();
for (let i = 0; i < 1000; i++) {
  getCollection();
}
console.log('Time:', performance.now() - start);
