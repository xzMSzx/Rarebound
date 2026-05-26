## 2023-10-27 - Converting O(N*M) array finds to Map lookups
**Learning:** In bulk processing functions that iterate over large portions of the collection, looking up item data using `Array.find` within the loop creates significant `O(N*M)` overhead, where N is the collection size and M is the card pool.
**Action:** Replace `Array.find` inside collection loops with an `O(N+M)` Map lookup. Cache the Map on an operation-scoped variable (or per-set scope if processing block-by-block) to avoid breaking tests that mutate global `localStorage` mock state.
