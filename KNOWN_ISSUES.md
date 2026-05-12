# Known Issues

## Critical

### AGS submission can charge the player without queuing a submission

- **Severity:** Critical
- **Affected files/modules:** `artifacts/msge-lite/ui/archiveServicesScreen.js`, `artifacts/msge-lite/data/agsSubmissionManager.js`, `artifacts/msge-lite/state/playerState.js`
- **Explanation:** `onSubmit` spends balance before calling `submitForGrading()`. If `submitForGrading()` returns `null`, or if AGS persistence silently fails, the player can lose money without an active submission. This is especially risky because `agsSubmissionManager.save()` swallows write errors.
- **Reproduction conditions:** Trigger AGS submission while the chosen copy becomes unavailable, storage quota is exceeded, or `localStorage.setItem('tcg_ags_submissions')` fails.
- **Suggested resolution direction:** Validate and reserve the copy before charging, or make a single AGS transaction helper that charges only after submission persistence succeeds. Return write success from AGS persistence instead of swallowing it.
- **Regression risk assessment:** High. AGS is a high-emotion system; fixes must preserve copy identity, hidden quality generation, modal flow, and balance updates.

### Pack opening can leave iOS body scroll permanently locked

- **Severity:** Critical
- **Affected files/modules:** `artifacts/msge-lite/main.js`, `artifacts/msge-lite/ui/scrollManager.js`, `artifacts/msge-lite/ui/fullscreenOverlay.js`, `artifacts/msge-lite/ui/packOpeningController.js`
- **Explanation:** `runPackOpening()` locks body scroll before async animation/data/reveal work and unlocks only on the normal path after `openPackOverlay()` resolves. Any thrown error can leave the page fixed, which is severe on iOS Safari.
- **Reproduction conditions:** Storage write failure, load/reveal exception, missing overlay DOM, or unexpected error after `lockBodyScroll()`.
- **Suggested resolution direction:** Wrap the whole locked region in `try/finally`. Keep reward commits ordered so failed UI cleanup cannot corrupt pack rewards.
- **Regression risk assessment:** High. Existing reveal/audio interactions are fragile, so change only the cleanup boundary first.

## High Priority

### AGS slabbed copies can be consumed by selling or requests

- **Severity:** High
- **Affected files/modules:** `artifacts/msge-lite/data/requestManager.js`, `artifacts/msge-lite/data/emergencyRequestManager.js`, `artifacts/msge-lite/data/sellingManager.js`, `artifacts/msge-lite/data/agsSubmissionManager.js`
- **Explanation:** Request eligibility and selling check collection counts/lock state, but do not subtract `lockedCopiesFor()`. Active and completed AGS copies are locked conceptually but not protected across all consumption paths.
- **Reproduction conditions:** Own a graded or active AGS copy plus few raw copies, then fulfill a request or sell until aggregate count conflicts with AGS registry.
- **Suggested resolution direction:** Centralize `availableRawCopies(setId, cardId)` and use it for selling, requests, emergency requests, and AGS eligibility.
- **Regression risk assessment:** High. This touches collection economy, requests, selling, AGS registry, and player trust.

### Count-only collection storage can desync AGS copy identity

- **Severity:** High
- **Affected files/modules:** `artifacts/msge-lite/data/collectionManager.js`, `artifacts/msge-lite/data/cardQualityManager.js`, `artifacts/msge-lite/data/agsSubmissionManager.js`
- **Explanation:** AGS/quality address copies by copy number, but collection stores only aggregate counts. Decrementing a card does not specify which physical copy was removed, so copy numbers can become stale after sales/request consumption.
- **Reproduction conditions:** Grade copy `c2`, then consume raw copies until collection count is less than the highest slabbed copy number.
- **Suggested resolution direction:** Short term: prevent consumption of AGS-locked copy counts. Long term: consider a lightweight per-card owned-copy ledger only for eligible AGS rarities.
- **Regression risk assessment:** High. A full ledger is risky; start with availability guards.

### Request completion is not transaction-safe

- **Severity:** High
- **Affected files/modules:** `artifacts/msge-lite/data/requestManager.js`, `artifacts/msge-lite/data/emergencyRequestManager.js`, `artifacts/msge-lite/main.js`
- **Explanation:** Requests decrement collection first, then clear request storage, then the caller pays rewards. A failure between these writes can remove cards without reward or leave a request repeatable.
- **Reproduction conditions:** `localStorage` write failure during request save, balance save failure after completion, or exception in caller reward flow.
- **Suggested resolution direction:** Move card consumption, request removal, and reward application into one commit helper with clear rollback/abort behavior.
- **Regression risk assessment:** Medium-high. Needs focused tests around normal, insufficient, and write-failure paths.

### Milestones can be marked claimed before rewards are applied

- **Severity:** High
- **Affected files/modules:** `artifacts/msge-lite/data/milestoneManager.js`, `artifacts/msge-lite/main.js`
- **Explanation:** `autoClaimReadyMilestones()` persists claimed IDs before `sweepMilestones()` applies cash, reputation, prestige, discounts, favor, and archive rewards. If reward application fails, the milestone cannot be retried.
- **Reproduction conditions:** Storage write or runtime error after milestone claim save but before all rewards apply.
- **Suggested resolution direction:** Have milestone sweep claim and reward in one orchestration layer, or track pending rewards until successfully applied.
- **Regression risk assessment:** Medium-high. Milestones are broad and touch many systems.

## Medium Priority

### Collection value snapshots appear to ignore duplicate counts

- **Severity:** Medium
- **Affected files/modules:** `artifacts/msge-lite/main.js`
- **Explanation:** Collection value loops add one market value per owned card ID, not per owned copy. Duplicates are sellable inventory elsewhere, so displayed/value-history totals may understate the collection.
- **Reproduction conditions:** Own multiple copies of a valuable card; stats/value history increase as if one copy exists.
- **Suggested resolution direction:** Decide whether value means unique archive value or total owned-copy value. Encode both as separate helpers if both are useful.
- **Regression risk assessment:** Medium. Changing it affects stats, archive peak events, and player perception of progress.

### Persistence layer lacks shared schema validation and corruption quarantine

- **Severity:** Medium
- **Affected files/modules:** Most `artifacts/msge-lite/data/*Manager.js`, `artifacts/msge-lite/state/playerState.js`
- **Explanation:** Many managers parse JSON independently and return defaults on corruption. This prevents crashes but can silently hide damaged saves.
- **Reproduction conditions:** Any malformed critical `localStorage` key.
- **Suggested resolution direction:** Add a small shared helper that validates shape, backs up corrupted payloads, and reports recovery state.
- **Regression risk assessment:** Medium. Introduce incrementally for critical stores first.

### `main.js` has too many ownership boundaries

- **Severity:** Medium
- **Affected files/modules:** `artifacts/msge-lite/main.js`
- **Explanation:** `main.js` now owns bootstrapping, scheduling, vendor UI, requests, pack opening, collection screens, binder, stats, sell modal, AGS entry points, and many reward hooks.
- **Reproduction conditions:** Future features added into `main.js` increase accidental regression risk.
- **Suggested resolution direction:** Extract only new/high-churn surfaces first: sell modal controller, stats value helpers, request fulfillment controller, AGS collection entry.
- **Regression risk assessment:** Medium. Refactor gradually; do not rewrite working flows.

### Overlay listener cleanup depends heavily on happy paths

- **Severity:** Medium
- **Affected files/modules:** `artifacts/msge-lite/ui/fullscreenOverlay.js`, `artifacts/msge-lite/ui/packOpeningController.js`, modal sections in `main.js`
- **Explanation:** Many listeners are cleaned after successful completion. Interrupted overlays, thrown errors, or missing DOM can skip cleanup.
- **Reproduction conditions:** Navigate/close during reveal, throw inside animation, or remove overlay DOM via debug flags.
- **Suggested resolution direction:** Use centralized cleanup functions and `finally` blocks around overlay lifecycles.
- **Regression risk assessment:** Medium. Touch carefully because reveal/audio feel is fragile.

## Low Priority

### Save write error behavior is inconsistent

- **Severity:** Low
- **Affected files/modules:** `collectionManager`, `playerState`, `marketHistory`, `marketValue`, `activityFeed`, `favoritesManager`, `wishlistManager`, AGS/history managers
- **Explanation:** Some writes throw, some swallow errors, and few return success. This complicates recovery and testing.
- **Reproduction conditions:** Quota errors, private browsing restrictions, malformed state.
- **Suggested resolution direction:** Standardize persistence helpers after the highest-risk transactional bugs are fixed.
- **Regression risk assessment:** Low-medium. The change is simple, but broad.

### Legacy `playerState.collection` still exists beside v2 collection

- **Severity:** Low
- **Affected files/modules:** `artifacts/msge-lite/state/playerState.js`, `artifacts/msge-lite/main.js`
- **Explanation:** Pack opening updates both legacy and v2 collection, while broker purchases update only v2. Any remaining legacy readers can see inconsistent ownership.
- **Reproduction conditions:** Buy a broker card, then inspect any old diagnostic/UI path reading `playerState.collection`.
- **Suggested resolution direction:** Mark legacy collection read-only/deprecated and remove remaining dependencies.
- **Regression risk assessment:** Low if audited first.
