# Event Lifecycle / Render Safety Scan

Scope: duplicated listeners, intervals, overlay cleanup, render duplication, stale closures, and screen transition behavior.

## Strong Signals

- Most screen render functions rebuild container content and attach listeners to fresh nodes, so many listener accumulations are naturally discarded.
- `archiveServicesScreen` guards the global `ags-tick` listener with `_hookedTick`.
- AGS reveal queue has a safety timer to prevent a stuck cinematic queue.
- Market search debounce clears the previous timer.

## Risks Found

### Global 30-second tick owns too many concerns

`main.js` has one global interval that handles recovery, vendor events, AGS ticking, market refresh, request staleness, hub re-render, stipend strip, chase strip, and market strip. It is currently single-instance because the module loads once, but the interval is a growing central scheduler with increasing regression surface.

### Render functions mix state mutation, DOM creation, and listener wiring

`main.js` is doing orchestration, rendering, economy actions, modal actions, binder navigation, statistics, and AGS entry points in one large file. This makes it easy for future render changes to accidentally change state behavior.

### Overlay cleanup is mostly happy-path based

`fullscreenOverlay.js` and `packOpeningController.js` remove many listeners after completion, but cleanup is not uniformly centralized. If an overlay is interrupted or throws, cleanup can be skipped.

### Debug listeners can accumulate noise

Diagnostics/debug tap probes attach multiple event listeners. They are useful for iOS isolation, but should stay dev-only and be guarded carefully so they do not become a production performance drag.

## Recommended Direction

- Keep the architecture vanilla, but split scheduling into named tick functions with a small registry in `main.js`.
- Make overlay open functions return or internally use a single cleanup function.
- Avoid adding more features directly to `main.js`; move new vertical systems behind manager/controller boundaries.
- Add a lifecycle checklist for any new modal: lock, render, bind, close, cleanup, unlock.
