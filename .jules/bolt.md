## 2024-05-24 - Scoped Cache for localStorage Desyncs in Tests
**Learning:** Adding persistent in-memory caching to `localStorage` wrappers (like `getCollection()`) can easily break existing unit tests. Tests in this codebase frequently mock `localStorage` directly and expect subsequent module calls to reflect their mocks immediately.
**Action:** Instead of caching data globally across the module, cache it narrowly within the scope of expensive sweeps (e.g. `try { _cache = fetch(); ... } finally { _cache = null; }`). This prevents redundant parsing without polluting test state.
