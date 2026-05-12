# Architecture Notes

## Strongest Decisions

- `runPackOpening()` remains the correct single source of truth for pack opening.
- Hidden per-copy quality is deterministic and lazy-migrated, which is a strong fit for local-only saves.
- Manager modules are small and mostly domain-focused.
- History stores are bounded, preserving `localStorage` headroom.
- The project is correctly staying vanilla and incremental; a framework rewrite would add risk without solving the core issues.

## Dangerous Coupling Areas

- AGS copy identity depends on collection counts that do not identify physical copies.
- Request/sell flows can mutate collection without consulting AGS lock state.
- `main.js` coordinates too many unrelated systems.
- Scroll lock correctness depends on every caller manually balancing lock/unlock.
- Milestone and request rewards are applied after state transitions rather than inside a safer operation boundary.

## Systems Scaling Well

- Market value/history separation is understandable.
- Archive history has a clear atmospheric role and bounded storage.
- Favorites and wishlist are simple identity sets.
- Vendor events and recovery mode are modular enough to reason about.
- AGS grading logic is separated from AGS submission persistence.

## Systems Approaching Instability

- Pack opening, because it combines UI, async animation, collection mutation, quality, milestones, history, reputation, and vendor favor.
- AGS, because it now needs physical-copy availability semantics.
- Requests, because they consume collection inventory and pay rewards across multiple stores.
- `main.js`, because its size makes regression review increasingly expensive.
- `style.css`, because mobile layering and modal polish become harder in one very large stylesheet.

## Recommended Future Modularization Targets

- Pack-opening commit phase: keep `runPackOpening()` authoritative, but extract post-reveal persistence/reward commit into a named helper.
- AGS availability service: one helper used by AGS, selling, requests, and emergency requests.
- Request transaction helper: consume cards, remove request, pay reward, and report success/failure coherently.
- Collection value helper: explicit unique-value and copy-value calculations.
- Overlay lifecycle helper: scoped scroll locks and cleanup.

## Regression-Sensitive Systems

- Pack reveal/audio/touch flow.
- iOS scroll locking and `iosTap()`.
- AGS hidden quality and slab registry.
- Collection save/load and copy counts.
- Request fulfillment and emergency recovery.
- Milestone auto-claim rewards.
- Market drift/history snapshots.
