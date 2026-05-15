## 2024-05-15 - Array allocations in high-frequency map-filter chains
**Learning:** Chaining `.map()` and `.filter()` over `Object.entries()` with large datasets creates heavy garbage collection overhead due to intermediate array allocations. `ui/marketScreen.js` was rendering 1000s of rows using this technique, creating noticeable performance drops.
**Action:** Replaced `.map().filter()` chains with a pre-allocated array and a simple `for...in` or standard `for` loop pushing valid items directly into the destination array.

## 2024-05-15 - Memoizing dynamic data with asynchronous populating
**Learning:** When trying to memoize an index over an array of constants (`SET_IDS`), assuming the array length won't change is safe, but assuming the background content of those keys won't change is NOT safe if data is loaded asynchronously.
**Action:** When creating a memoization cache key over dynamically loaded data structures (like `getCachedSetCards(setId)`), accumulate a total object count (e.g., number of cards) across all items to use as a lightweight yet robust invalidation trigger.
