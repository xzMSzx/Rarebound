## 2024-05-24 - Scoped Cache for localStorage Desyncs in Tests
**Learning:** Adding persistent in-memory caching to `localStorage` wrappers (like `getCollection()`) can easily break existing unit tests. Tests in this codebase frequently mock `localStorage` directly and expect subsequent module calls to reflect their mocks immediately.
**Action:** Instead of caching data globally across the module, cache it narrowly within the scope of expensive sweeps (e.g. `try { _cache = fetch(); ... } finally { _cache = null; }`). This prevents redundant parsing without polluting test state.
## 2024-05-17 - [Array.find vs Map lookup in Evolution Chains]
**Learning:** In `msge-lite/main.js`, `buildEvolutionChain` reconstructs a hash map of pokemon by name (`new Map(pokémon.map(c => [c.name, c]))`) *on every call*, which makes it slower (~260ms) than the previous unoptimized `Array.find` (~60ms). However, memoizing the Map globally per `setId` makes it extremely fast (~8ms).
**Action:** When converting Array.find() to Map lookup for performance in frequently called UI builder functions, memoize the Map to avoid `O(N)` Map instantiation overhead on every call.
## 2026-05-21 - Operation-Scoped Caching for Data Processing Bottlenecks
**Learning:** During collection valuation, converting `cached.find()` into an `O(1)` map lookup yielded a 2.5x speedup for large user portfolios. However, storing the instantiated Map on the module scope breaks Vitest tests because the codebase heavily mocks/mutates state.
**Action:** When performing `Array.find()` to Map lookups to resolve O(N) bottlenecks in bulk data processing like `computeTotalCollectionValue`, cache the instantiated Map on a transient context object passed down the stack (e.g., `ctx._apiCardMapCache`), and clear it in a `finally` block to avoid global side-effects.

## 2024-05-27 - Operation-Scoped Caching for `localStorage` loops
**Learning:** Calling `JSON.parse` continuously inside loop constructs reading from `localStorage` (like `getCollection()`) produces an O(N) performance bottleneck.
**Action:** Always wrap tight loops that repeatedly fetch and modify the entire JSON store in an operation-scoped cache using `try...finally` wrappers. This enables safe multi-read/write performance isolation while satisfying functional Vitest requirements.
