## 2024-05-24 - Scoped Cache for localStorage Desyncs in Tests
**Learning:** Adding persistent in-memory caching to `localStorage` wrappers (like `getCollection()`) can easily break existing unit tests. Tests in this codebase frequently mock `localStorage` directly and expect subsequent module calls to reflect their mocks immediately.
**Action:** Instead of caching data globally across the module, cache it narrowly within the scope of expensive sweeps (e.g. `try { _cache = fetch(); ... } finally { _cache = null; }`). This prevents redundant parsing without polluting test state.
## 2024-05-17 - [Array.find vs Map lookup in Evolution Chains]
**Learning:** In `msge-lite/main.js`, `buildEvolutionChain` reconstructs a hash map of pokemon by name (`new Map(pokémon.map(c => [c.name, c]))`) *on every call*, which makes it slower (~260ms) than the previous unoptimized `Array.find` (~60ms). However, memoizing the Map globally per `setId` makes it extremely fast (~8ms).
**Action:** When converting Array.find() to Map lookup for performance in frequently called UI builder functions, memoize the Map to avoid `O(N)` Map instantiation overhead on every call.
