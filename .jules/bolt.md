## 2024-05-17 - [Array.find vs Map lookup in Evolution Chains]
**Learning:** In `msge-lite/main.js`, `buildEvolutionChain` reconstructs a hash map of pokemon by name (`new Map(pokémon.map(c => [c.name, c]))`) *on every call*, which makes it slower (~260ms) than the previous unoptimized `Array.find` (~60ms). However, memoizing the Map globally per `setId` makes it extremely fast (~8ms).
**Action:** When converting Array.find() to Map lookup for performance in frequently called UI builder functions, memoize the Map to avoid `O(N)` Map instantiation overhead on every call.

## 2024-05-18 - [Array.find vs Map lookup in Collection Valuation]
**Learning:** In `msge-lite/data/collectionValuation.js`, `lineValueForCollectionEntry` used an unoptimized `Array.find` call inside a loop over the player's entire collection to retrieve API card data. When computing total collection value (which iterates over all owned cards), this resulted in O(N*M) overhead. Using an operation-scoped cached Map on the valuation `ctx` object dramatically improved the lookup speed while avoiding global persistent caches that break Vitest.
**Action:** When computing bulk valuations that perform repeated list lookups, construct a cached hash map stored on the operation context to ensure O(1) lookups without mutating global state.
