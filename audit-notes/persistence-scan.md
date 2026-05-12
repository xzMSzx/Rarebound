# Persistence Scan

Scope: `artifacts/msge-lite` vanilla JS game state, especially `localStorage`, AGS, collection, quality fingerprints, archive/value/history, and pack-opening mutation flow.

## Strong Signals

- `runPackOpening()` in `main.js` is still the authoritative pack reward path for direct vendor pack purchases and mystery boxes.
- Per-copy quality generation is placed immediately after `addCardToCollection()`, which correctly captures copy ordering for duplicate pulls inside one pack.
- Most read paths tolerate invalid JSON by returning a default value, preventing many boot-time crashes from corrupted optional stores.
- History-like stores are bounded (`activityFeed`, `recentHits`, `archiveHistoryManager`, `collectionValueHistory`, `marketHistory`), which is good for long-term `localStorage` pressure.

## Risks Found

### Multi-step transactions can partially commit

Affected modules:

- `main.js` pack opening, request fulfillment, AGS submission, broker purchase
- `collectionManager.js`
- `requestManager.js`
- `emergencyRequestManager.js`
- `playerState.js`
- `agsSubmissionManager.js`

Many operations mutate several stores in sequence without a transaction boundary. Examples:

- AGS submission spends balance before `submitForGrading()` persists the submission.
- Request completion decrements collection before request storage is cleared and before reward balance is applied by the caller.
- Pack opening spends balance, opens UI, mutates engine state, writes legacy player collection, writes v2 collection, writes quality, writes history, then reputation/milestones.

If `localStorage.setItem()` throws from quota/private-mode behavior or a downstream exception occurs, the save can land in a mixed state.

### Save write handling is inconsistent

Some critical stores swallow write errors (`agsSubmissionManager`, `cardQualityManager`, archive/value history), while others allow exceptions to propagate (`collectionManager`, `playerState`, `marketHistory`, `marketValue`, favorites/wishlist).

This creates two bad failure modes:

- visible crashes in critical flows when unguarded writes throw;
- silent desync when guarded writes fail but caller assumes success.

### AGS copy identity is vulnerable to count-only collection storage

AGS uses `setId:cardId:cN` to lock specific copies, but collection ownership only stores aggregate `count`. Selling/request systems decrement counts without preserving which copy was consumed. If a lower-number raw copy is sold while a higher copy is slabbed, the AGS registry can reference a copy number that no longer exists under the aggregate count.

### AGS locks are not enforced by all consumption paths

`findEligibleCards()` in `requestManager.js` only checks collection lock/wishlist state. It does not subtract `lockedCopiesFor()`. `sellingManager.js` also gates only last-copy lock, not AGS locks. This allows active or completed AGS copies to be effectively consumed by sale/request paths while slabs remain in the registry.

### Corrupted required stores silently reset

Invalid JSON in key stores returns empty state. That is safer than crashing, but dangerous for player identity stores:

- collection
- player balance
- AGS submissions
- quality fingerprints
- favorites/wishlist

The current behavior does not quarantine corrupted raw data or expose recovery diagnostics.

## Recommended Direction

- Add a tiny shared persistence helper for read/write with schema validation, backup-on-corruption, and write success reporting.
- Introduce operation-level commit helpers for AGS submission and request fulfillment first.
- Treat AGS locks as part of collection availability, not only AGS UI eligibility.
- Add save-integrity tests for corrupted JSON and write failure simulation.
