# Technical Debt

## Architecture Debt

### `main.js` orchestration density

- **Why it exists:** The project grew vertically, and `main.js` absorbed glue code for each new system.
- **Future risk:** Feature changes in one area can regress unrelated systems.
- **Recommended timing:** Begin now, only when touching a system.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Partially. It will slow safe additions to AGS, requests, stats, and overlays.

### Legacy and current collection models coexist

- **Why it exists:** `playerState.collection` was kept for compatibility after v2 collection storage was introduced.
- **Future risk:** Hidden readers may see inconsistent ownership, especially broker acquisitions.
- **Recommended timing:** Soon, after source-of-truth tests are added.
- **Estimated complexity:** Low-medium.
- **Blocks future systems:** Yes for systems needing precise owned-copy semantics.

## Persistence Debt

### No shared persistence contract

- **Why it exists:** Managers own their own tiny `load()`/`save()` functions.
- **Future risk:** Inconsistent corruption handling, silent resets, unreported quota failures.
- **Recommended timing:** Start with collection, player, AGS, quality, and request stores.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Yes for long-term save integrity.

### Multi-store operations lack transaction boundaries

- **Why it exists:** Vanilla `localStorage` encourages simple independent writes.
- **Future risk:** Partial commits can desync balance, collection, AGS, milestones, and requests.
- **Recommended timing:** Immediate for AGS submission and request completion.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Yes for emotionally valuable progression systems.

## UI/Render Debt

### Modal lifecycle patterns are repeated

- **Why it exists:** Each modal/screen was implemented locally.
- **Future risk:** Missing cleanup, duplicated listener patterns, scroll lock imbalance.
- **Recommended timing:** Opportunistic, but fix pack-opening lock first.
- **Estimated complexity:** Low-medium.
- **Blocks future systems:** No, but increases regression risk.

### Large stylesheet

- **Why it exists:** Premium UI has grown in one CSS file.
- **Future risk:** Selector collisions and difficulty auditing mobile layering.
- **Recommended timing:** Later, after stability fixes.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Not yet, but it will slow visual iteration.

## Mobile Compatibility Debt

### `iosTap()` is convention-dependent

- **Why it exists:** It solves Safari tap unreliability by calling handlers directly.
- **Future risk:** Any future handler expecting an event will fail only on iOS.
- **Recommended timing:** Now as a documented pattern; later as a helper wrapper.
- **Estimated complexity:** Low.
- **Blocks future systems:** No, but it can create subtle mobile-only bugs.

### Scroll lock needs scoped safety

- **Why it exists:** Reference-counting exists, but callers manually balance locks.
- **Future risk:** Exceptions leave the app fixed on iOS.
- **Recommended timing:** Immediate for pack opening, then modal-by-modal.
- **Estimated complexity:** Low.
- **Blocks future systems:** Yes for reliable mobile-first UX.

## Economy System Debt

### Collection value meaning is ambiguous

- **Why it exists:** Value history uses unique owned IDs while duplicate copies are sellable elsewhere.
- **Future risk:** Player-facing stats may disagree with economy reality.
- **Recommended timing:** Soon.
- **Estimated complexity:** Low.
- **Blocks future systems:** Partially, especially prestige/value milestones.

### Reward application ordering is fragile

- **Why it exists:** Rewards are applied in caller code after manager state changes.
- **Future risk:** Claimed-but-unpaid milestones, completed-but-unrewarded requests.
- **Recommended timing:** Immediate for high-value systems.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Yes for more complex event rewards.

## AGS System Debt

### Aggregate counts do not model physical copies

- **Why it exists:** Collection v2 predates per-copy AGS identity.
- **Future risk:** Slabs can reference copy IDs that aggregate collection counts can no longer prove exist.
- **Recommended timing:** Guard now, consider lightweight ledger later.
- **Estimated complexity:** Guard: low-medium. Ledger: medium-high.
- **Blocks future systems:** Yes for deeper grading, trading, or provenance.

### AGS locks are not universally respected

- **Why it exists:** AGS availability logic lives in AGS UI/manager, while selling/request logic predates it.
- **Future risk:** Active/completed slabs can be consumed indirectly.
- **Recommended timing:** Immediate.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Yes.

## Performance Debt

### Central interval does broad work every 30 seconds

- **Why it exists:** One scheduler grew with each system.
- **Future risk:** More systems will make background ticks harder to reason about.
- **Recommended timing:** Later, unless tick cost becomes visible.
- **Estimated complexity:** Low-medium.
- **Blocks future systems:** Not yet.

### Large render functions rebuild sizeable DOM sections

- **Why it exists:** Vanilla rendering is simple and predictable.
- **Future risk:** Collection/binder/market growth may cause mobile jank.
- **Recommended timing:** Only when profiling shows a problem.
- **Estimated complexity:** Medium.
- **Blocks future systems:** No.

## Scaling Risks

### `localStorage` quota pressure

- **Why it exists:** Many bounded and unbounded stores share browser quota.
- **Future risk:** Failed writes in high-value stores.
- **Recommended timing:** Add write-failure handling before adding more history/provenance.
- **Estimated complexity:** Medium.
- **Blocks future systems:** Yes for long-term collection growth.

### No save diagnostics surface

- **Why it exists:** Managers recover silently.
- **Future risk:** Players may lose data with no actionable message.
- **Recommended timing:** After persistence helper exists.
- **Estimated complexity:** Medium.
- **Blocks future systems:** No, but important for trust.

## Refactor Candidates

- `requestFulfillmentController`: transaction-safe request completion and reward application.
- `agsAvailability`: shared raw-copy availability and AGS lock checks.
- `collectionValueService`: one authoritative place for unique value vs total copy value.
- `overlayLifecycle`: scoped scroll lock and cleanup utility.
- `persistenceStore`: tiny localStorage read/write/backup/schema helper.
- `sellModalController`: move sale orchestration out of `main.js`.
