# iOS / WebKit Scan

Scope: iOS Safari runtime risks, gesture handling, scroll lock, overlay timing, TDZ/order concerns, and `iosTap()` behavior.

## Strong Signals

- `iosTap()` explicitly calls handlers with zero args, and many call sites wrap handlers in zero-argument closures.
- Scroll locking is reference-counted in `scrollManager.js`, which is the right direction for nested overlays.
- Pack reveal and card reveal systems include several iOS-aware comments and fallbacks.
- Debug isolation flags exist for scroll, overlays, dock, and iOS tap behavior.

## Risks Found

### `runPackOpening()` can leave body scroll locked

`runPackOpening()` calls `lockBodyScroll()` before animation/data/reveal work and only calls `unlockBodyScroll()` after `openPackOverlay()` resolves. There is no `try/finally`. Any exception during load, reveal, overlay, collection write, or quality write can leave the body fixed on iOS.

### `iosTap()` suppresses synthetic click and calls handler without event

The helper is intentionally zero-arg. Current obvious call sites mostly respect this, but the pattern is fragile because some code also binds native `click` handlers that receive events. Future handlers may rely on `event.target`, `stopPropagation()`, or `currentTarget` and break only on iOS.

### Overlay lifecycle uses repeated closures and timeouts

Pack interaction and reveal overlays attach pointer/touch listeners per open. Most are cleaned up on the happy path, but several cleanup paths depend on the player reaching the final tap state. Interrupted flows, exceptions, or DOM removal can leave listeners or scroll locks behind.

### Touch/passive choices are mixed

The project correctly uses non-passive `touchend` in `iosTap()` to call `preventDefault()`, but other overlay controls use passive touch listeners while also trying to absorb propagation. That is mostly fine, but it needs regression tests around double-fire and missing-fire scenarios on mobile Safari.

## Recommended Direction

- Wrap every scroll lock with `try/finally` or a scoped helper.
- Keep `iosTap()` handlers eventless by convention; add a small comment or lintable helper pattern for new call sites.
- Add smoke tests or manual checklist cases for iOS: pack open, skip reveal, open AGS modal, close nested modal, sell modal, market modal.
- Prefer named cleanup functions for overlay listeners, including pointercancel/touchcancel paths.
