1. **Understand the problem**:
   `getCollection()` parses `localStorage` via JSON every single time it is called. Since it's used extensively within loops across `main.js` and other data modules, this creates an O(N) performance bottleneck.
   Specifically, when adding cards to the collection (e.g. `addCardToCollection`), `getCollection()` is called. In `main.js` line ~2385, `newDiscoveries` loops over 10 cards using `getOwnedEntry()`, which calls `getCollection()`. Then `newCards.forEach` calls `addCardToCollection`, which again calls `getCollection()`, mutates it, and calls `saveCollection()`. Finally, it fetches `getOwnedEntry()` again. That is over 30 reads and 10 writes of the ENTIRE collection JSON just for one pack opening!

2. **Determine the best fix**:
   We can introduce `runWithCollectionCache(fn)` in `data/collectionManager.js` to provide an operation-scoped cache.

   ```javascript
   let _operationCache = null;

   export function getCollection() {
     if (_operationCache) return _operationCache;
     return readJson(STORAGE_KEY, {}, isPlainObject).value;
   }

   export function saveCollection(collection) {
     const result = writeJson(STORAGE_KEY, collection);
     if (_operationCache) _operationCache = collection;
     return result;
   }

   export function runWithCollectionCache(fn) {
     if (_operationCache) return fn();
     try {
       _operationCache = getCollection();
       return fn();
     } finally {
       _operationCache = null;
     }
   }
   ```
   Wait, if we use `runWithCollectionCache(fn)` in `main.js`, `addCardToCollection` will save the object reference `collection` back to the cache in `saveCollection`. This works properly.
   Wait! Does `saveCollection` write to `localStorage` on EVERY call inside the loop? Yes!
   Can we optimize that too? We are allowed ONE small performance optimization. The prompt asks to find ONE small performance improvement (< 50 lines). Caching `getCollection` during `runWithCollectionCache` fits the < 50 lines criteria and has a HUGE impact.

   Actually, if we just cache `getCollection` locally in `main.js` around the loop, we'd have to modify `addCardToCollection` to accept an optional collection argument, or use the `runWithCollectionCache` wrapper.
   But there's an even simpler change: `addCardToCollection` already calls `getCollection()` and `saveCollection()`.

   Wait, another memory:
   > "Codebase-specific performance pattern: Avoid synchronous `localStorage` reads (e.g., `JSON.parse` via `readJson`) inside bulk processing loops, such as iterating over collections. Instead, load the data once before the loop and cache it in an operation-scoped context (e.g., `ctx._agsStoreCache`) to prevent O(N) JSON parsing overhead."

   Wait, if we do:
   ```javascript
   export function runWithCollectionCache(fn) {
     if (_operationCache) return fn();
     try {
       _operationCache = getCollection();
       return fn();
     } finally {
       _operationCache = null;
     }
   }
   ```
   And then wrap the pack-opening post-processing in `main.js`:
   ```javascript
   import { runWithCollectionCache } from './data/collectionManager.js';

   // later in main.js openPack...
   runWithCollectionCache(() => {
     const newDiscoveries = newCards.filter(c => !getOwnedEntry(setId, c.id)).length;
     newCards.forEach(addCard);

     newCards.forEach(c => {
       addCardToCollection(c);
       const tier = c.rarityType || c.rarity;
       if (!isEligibleRarity(tier)) return;
       try {
         const copyN = getOwnedEntry(setId, c.id)?.count || 1;
         ensureQualityForCopy(setId, c.id, copyN, tier, { sourceVendor: vendor });
       } catch (err) { console.error('[quality] per-copy generation failed', err); }
     });
   });
   ```

   Wait! Is there another place in `main.js` that iterates over `getCollection`?
   Look at `renderStatsScreen()`:
   ```javascript
   const collection  = getCollection();
   ```
   It gets it once, it's fine.

   What about `getCollection()` inside `buildCardDetailHTML()` or `renderRecentHits()`?
   ```javascript
   hits.forEach(hit => {
     // onClick:
     const ownedEntry = getCollection()[hit.setId]?.[hit.cardId] ?? null;
   });
   ```
   That's deferred, no loop parsing.

   What about `getMilestoneStatus()` in `milestoneManager.js`? It already uses `_sweepCollection`.

   So the biggest bottleneck is indeed the pack opening `newCards.forEach` loop! 10 writes AND reads!
   Actually, `addCardToCollection` writing to `localStorage` 10 times is still bad, but at least we can eliminate the 10-30 `JSON.parse` reads by using `runWithCollectionCache`.

   Wait, what if we just exported `addCardsToCollection(cards)` in `collectionManager.js`?
   ```javascript
   export function addCardsToCollection(cards) {
     const collection = getCollection();
     for (const card of cards) {
       const { setId, id: cardId, isReverseHolo } = card;
       if (!setId || !cardId) continue;
       if (!collection[setId]) collection[setId] = {};
       if (!collection[setId][cardId]) collection[setId][cardId] = { count: 0, locked: true };
       collection[setId][cardId].count += 1;
       if (isReverseHolo) collection[setId][cardId].reverseHolo = (collection[setId][cardId].reverseHolo || 0) + 1;
     }
     saveCollection(collection);
   }
   ```
   But we need to get the `copyN` for each card AT THE MOMENT OF ADD to associate it with quality, so `addCardsToCollection` doesn't easily provide the intermediate `copyN`s unless it returns an array of `copyN`s.
   But `runWithCollectionCache(fn)` handles BOTH reads and writes inside any scoped block!

   Let's check if there are other areas. `renderCollectionScreen` iterates over `Object.entries(collection)`, but it only calls `getCollection()` once.

   Wait! What about `tests/persistenceStore.test.js` or `tests/collectionManager.test.js`? Will `runWithCollectionCache` break tests?
   "Vitest testing patterns in the codebase often mock and directly mutate `localStorage`, causing persistent in-memory caches to desynchronize and break tests."
   `runWithCollectionCache` sets the cache `null` in `finally`, so it is NOT persistent across tests. It perfectly satisfies the memory constraint!

3. **Plan details**:
   - In `data/collectionManager.js`:
     ```javascript
     let _operationCache = null;

     export function getCollection() {
       if (_operationCache) return _operationCache;
       return readJson(STORAGE_KEY, {}, isPlainObject).value;
     }

     export function saveCollection(collection) {
       const result = writeJson(STORAGE_KEY, collection);
       if (_operationCache) _operationCache = collection;
       return result;
     }

     export function runWithCollectionCache(fn) {
       if (_operationCache) return fn();
       try {
         _operationCache = getCollection();
         return fn();
       } finally {
         _operationCache = null;
       }
     }
     ```
   - In `main.js`:
     ```javascript
     // Update imports:
     import {
       getCollection, addCardToCollection, getOwnedEntry, runWithCollectionCache
     } from './data/collectionManager.js';

     // Inside openPack (around line 2385):
     runWithCollectionCache(() => {
       const newDiscoveries = newCards.filter(c => !getOwnedEntry(setId, c.id)).length;
       newCards.forEach(addCard);

       newCards.forEach(c => {
         addCardToCollection(c);
         const tier = c.rarityType || c.rarity;
         if (!isEligibleRarity(tier)) return;
         try {
           const copyN = getOwnedEntry(setId, c.id)?.count || 1;
           ensureQualityForCopy(setId, c.id, copyN, tier, { sourceVendor: vendor });
         } catch (err) { console.error('[quality] per-copy generation failed', err); }
       });
     });
     ```

   Let's benchmark the difference this makes.
