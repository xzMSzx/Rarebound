# RAREBOUND — Digital Trading Card Collection

A vanilla JS / Vite Pokémon TCG collection sim with a four-vendor living economy, dynamic market values, favor + reputation progression, mystery boxes, and a chase-card Broker. Premium minimalist aesthetic, mobile-first.

## Run & Operate

- `pnpm --filter @workspace/msge-lite run dev` — runs the web artifact
- `pnpm run typecheck` — full monorepo typecheck
- Dev console helpers: `window.resetBalance()`, `window.giveMoney(n)`
- In-app: Settings → Developer Access (passphrase `rarebound-dev`) unlocks Archive Utilities + Infinite Balance.

## Stack

- **Build**: Vite (vanilla JS, no framework)
- **State**: localStorage only — no backend
- **Card data**: pokemontcg.io public API, cached in-memory per session
- **Audio**: WebAudio synthesizer — no external audio assets shipped

## Where things live

```
artifacts/msge-lite/
├── main.js                          ← top-level wiring + UI screens + runPackOpening helper
├── index.html, style.css            ← Phase 10.1 styles appended at file tail
├── data/
│   ├── settingsManager.js           ← settings store + APP_VERSION
│   ├── hapticManager.js             ← navigator.vibrate gated by setting
│   ├── ambientAudioManager.js       ← Phase 10.1 — WebAudio synth ambient + UI sfx
│   ├── devAccess.js                 ← Phase 10.1 — passphrase unlock + sandbox flag
│   ├── mysteryBoxManager.js         ← Phase 10.1 — 3 box types, weekly offerings
│   ├── economyManager.js, vendorManager.js, reputationManager.js, sellingManager.js
│   ├── collectionManager.js, marketValue.js, marketHistory.js, chaseManager.js
│   ├── stipendManager.js, recentHits.js, packStore.js
│   └── wishlistManager.js, cardPoolManager.js, rarityMapper.js
├── state/playerState.js             ← real economy ($120 start, infinite-balance bypass, wasFreshLaunch)
├── ui/
│   ├── bootScreen.js                ← premium boot overlay + real preload stages
│   ├── settingsScreen.js            ← toggles + Developer Access UI + Archive Utilities + System Diagnostics
│   ├── helpScreen.js                ← accordion onboarding (20 topics)
│   ├── marketScreen.js              ← market browser + SVG graph w/ tooltip + richer reasoning
│   ├── utilityDock.js               ← Phase 10.1 — collapsible top-right dock
│   ├── mysteryBoxOverlay.js         ← Phase 10.1 — 3-tile sealed reveal modal
│   └── (DO NOT EDIT) reveal/audio/pack controllers
└── simulations/packSimulation.js    ← RNG/pity (DO NOT EDIT)
```

## Architecture decisions

- **No framework** — DOM strings + event handlers. Keeps reveal/audio systems untouched.
- **All state in localStorage** under namespaced `tcg_*` keys.
- **Boot screen** narrates 6 real preload stages and gates Vendor Hub via `body.boot-locked`. Heavy work (`preloadAllSetsAsync`, `hydrateChaseSystemsAsync`) is awaited; lightweight hydration (`loadPlayerState`, `initEconomy`) stays synchronous so top-level renders don't see empty state.
- **Centralized economy engine** — `economyManager.tickEconomy()` orchestrates refresh ticks; never scattered.
- **Shared pack-opening helper** — `runPackOpening(setId, vendor, opts)` in main.js handles balance debit, animation, card grant, favor, reputation, recent hits, and set completion. Both direct purchases and mystery boxes feed through it (with `skipSpend: true` for mystery boxes since payment was the box price).
- **Mystery boxes** — `mysteryBoxManager.rollBoxContents(boxId)` returns 3 weighted setIds; the reveal modal flips them then `runPackOpening` is invoked sequentially.
- **First copies auto-lock** in `collectionManager`. Selling a locked last-copy requires explicit unlock confirmation in `sellingManager`.
- **Card values persist + drift** — `marketValue.tickMarketValues(trend)` walks each value within rarity-bound volatility, biased by the active trend.
- **Refresh cycle**: `REFRESH_INTERVAL_MS = 30 * 60 * 1000` (dev). Architecture supports 24h by changing one constant.
- **Broker time gate**: `isVendorOpen('broker')` returns true only on Fri/Sat/Sun. Weekly inventory keyed to Friday in `chaseManager.getBrokerInventory()`.
- **Vendor stock shuffles** per refresh so PokéMart / Retro Vault rotate slices instead of always presenting the first N sets.
- **Mystery box offerings** are deterministic per ISO-week (`tcg_box_offerings`) — Night Market always stocks Midnight Bundle, Retro Vault stocks Vintage Archive Crate ~50% of weeks, Broker stocks Collector Cache ~33% of weeks.
- **Reputation never decreases** — gained from packs, discoveries, rare pulls, set completions (+250). 7 ranks: Rookie → Collector → Advanced → Elite → Master → Archive Curator → Legendary.
- **Sandbox Mode** — when Infinite Balance is on (`devAccess.isSandboxMode()`), `reputationManager.addReputation` short-circuits to a no-op so casual testing never contaminates rank progression. A "DEV" badge surfaces in the top-left.
- **Ambient audio is fully synthesized** — `ambientAudioManager.js` builds per-vendor drones from oscillators + filters + LFO, plus tiny enveloped UI sfx (click, purchase, rareShimmer, pageFlip, wishlistTick, graphSweep, boxSeal). NO audio asset files are ever shipped — honors the no-placeholder rule.
- **Vendor ambience swaps via IntersectionObserver** on `.vendor-card[data-vendor-id]` in `renderVendorHub`.
- **Haptics** routed through `data/hapticManager.js` — settings-gated `navigator.vibrate` with three strengths (soft/medium/heavy).
- **Reduced motion** — `applyReducedMotion()` toggles `data-reduced-motion` on `<html>`, CSS shortens all transitions/animations and disables hub gradient drift.
- **Settings hooks** — `setSettingsHooks({ onBalanceChanged, onVendorsChanged, onMarketRefreshed, onReputationReset, onInfiniteToggled })` called from main.js so dev tools refresh the live UI without page reload.

## Storage keys

- `tcg_player_v2` — `{ balance }`
- `tcg_collection_v2` — `{ [setId]: { [cardId]: { count, locked } } }`
- `tcg_market_values`, `tcg_market_meta`, `tcg_market_history`
- `tcg_economy`, `tcg_favor`, `tcg_vendor_stocks`, `tcg_reputation`
- `tcg_chase`, `tcg_broker_inv`, `tcg_stipend`, `tcg_recent_hits`
- `tcg_settings` — `{ ambientAudio, haptics, reducedMotion }`
- `tcg_dev_access` — `{ unlocked, unlockedAt }` (Phase 10.1)
- `tcg_infinite_balance` — `boolean` (Phase 10.1)
- `tcg_box_offerings` — `{ weekKey, retroVault, broker }` (Phase 10.1)
- `tcg_wishlist`, `tcg_stats`

## Product

- **Boot screen** — RAREBOUND identity overlay with rotating preload labels; fades into Vendor Hub.
- **Vendor Hub**: 4 themed vendors — PokéMart (modern, -5%), Retro Vault (vintage, +20%), Night Market (random discounts), Broker (Fri–Sun chase singles, $350–$2200 weekly). Each vendor may also stock a Mystery Box.
- **Mystery Boxes** (Phase 10.1): Midnight Bundle ($54, Night Market always), Vintage Archive Crate ($78, Retro Vault occasional), Collector Cache ($145, Broker occasional). Each opens 3 sealed packs with a flip-reveal modal then sequential pack openings.
- **Utility Dock** (Phase 10.1): collapsible top-right pill containing Help + Settings.
- **Settings**: ambient audio (live toggle), haptics, reduced motion, Reset Local Save with confirm modal, Developer Access entry, version footer.
- **Developer Access** (Phase 10.1): passphrase-gated archive utilities — balance grants, force vendor refresh, force market refresh, force broker arrival, reset reputation, reset economy, clear market history, lock dev. Infinite Balance toggle puts the save into Sandbox Mode (DEV badge appears, reputation paused).
- **Help Center**: accordion explaining all systems including Mystery Boxes, Vendor Rotations, Chase Card System, Developer Access, Sandbox Mode, Infinite Balance.
- **Daily chase card**, **market screen** (sparklines + 7-day graph modal with tooltip + richer trend reasoning), **daily stipend**, **recent hits rail** (rarity labels + ultra/secret glow), **collection binders** with evolution chains.
- **Selling system** with vendor selection, commission breakdown, lock warnings.
- **Reputation** with 7 ranks; **market trends** (8 types); wishlist; statistics dashboard.
- **Subtle gradient drift** behind hub for living atmosphere.

## Gotchas

- DO NOT modify `ui/packOpeningController.js`, `ui/cardRevealAnimator.js`, `ui/fullscreenOverlay.js`, `ui/audioManager.js`, `simulations/packSimulation.js`, or `data/rarityMapper.js`.
- All card images come from `pokemontcg.io` — no local image assets except pack art under `public/packs/`.
- `playerState.addCard()` is legacy — actual collection writes go through `collectionManager.addCardToCollection()`.
- Boot screen: `loadPlayerState()` and `initEconomy()` MUST stay synchronous at top-level.
- Ambient vendor audio is fully synthesized at runtime (WebAudio) — never add audio asset files.
- `runPackOpening` is the single source of truth for pack flow. Mystery boxes pass `skipSpend: true` and a per-pack `favorBasis` so favor scales correctly.
- `spendBalance` honors infinite balance — UI pre-checks should use `isInfiniteBalance() || getBalance() >= price`.
- **`.screen.hidden { display: none; touch-action: none }` (specificity 0-2-0) is essential — do not remove these properties.** `.screen { display:flex }` (0-1-0) appears after `.hidden { display:none }` (0-1-0) in style.css, so equal-specificity cascade makes every `class="screen hidden"` element render as `display:flex`. On iOS WebKit, `touch-action:pan-y` (from `.overlay-scroll-screen`) on those invisible fixed full-viewport layers is evaluated by the native gesture recogniser *before* `pointer-events:none` filtering, suppressing click events on all `#store-screen` buttons. The `display:none` removes the layer; `touch-action:none` eliminates residual gesture claims during the 240 ms close-animation window. `initScreens()` in main.js adds belt-and-suspenders inline `style.display='none'` at startup for the same reason.
- **`#card-detail-modal.hidden` and `#sell-modal.hidden` (specificity 1-1-0) are essential — do not remove.** Both modals have `#id { display:flex; position:fixed; inset:0; z-index:300/320 }` at ID specificity (1-0-0) which BEATS `.hidden { display:none }` (0-1-0). Without the `#id.hidden` override at (1-1-0) they sit as invisible full-viewport layers with `pointer-events:auto` covering all buttons. `#card-detail-modal` (z-300) blocks nav/binder buttons; `#sell-modal` (z-320) matches the dock. The dock's trigger survives only because it has an explicit `pointer-events:auto` rule. This is Phase 10.1.7.
- **`iosTap(el, handler)` in main.js is the iOS click bypass** — all critical nav, binder, stats, and market buttons use both `.onclick` (desktop mouse fallback) and `iosTap` (iOS touchend direct dispatch). On iOS, `iosTap` fires the handler on touchend and calls `e.preventDefault()` to suppress the subsequent synthetic click so handlers never double-fire. Do not remove the non-passive touchend listener — making it passive would silently break the double-fire guard.
- **Phase 10.1.8 — HARD ISOLATION DEBUG MODE** is wired in via `data/debugFlags.js`. URL-flag-driven feature toggles let you disable subsystems one at a time on a real device without redeploying: `?nodock=1`, `?noaudio=1`, `?noscroll=1`, `?noboot=1`, `?nooverlays=1`, `?noiostap=1`, or `?debugall=1` for everything.
- **Phase 10.2 — Production Cleanup**: `isDebugMode()` in `debugFlags.js` gates ALL debug output. In normal mode, zero diagnostic logs fire and the DEBUG TAP button is never injected. Activate via `?debug=1` URL flag or `window.__RAREBOUND_DEBUG__ = true` in console. Any isolation flag (`?nodock=1` etc.) also activates debug mode automatically.
- **Phase 10.3 — Internal Developer Diagnostics System**: Settings → Developer Access now contains a collapsed "System Diagnostics" section. Master toggle persists to `tcg_dev_diagnostics`. Sub-flags in `tcg_dev_diag_flags`: `showOverlay` (glass FPS/screen/audio panel, bottom-right), `showDebugTap` (red debug button), `touchTrace`, `navAudit`, `audioDiag`. Subsystem isolation flags (`tcg_dev_isolation`: noDock/noAudio/noScroll/noBoot/noOverlays/noIosTap) are now settable via UI toggles (require reload). `isDebugMode()` returns true when `tcg_dev_diagnostics` is set. Sub-flag guards: navAudit → `isDiagFlag('navAudit')`, touchTrace → `isDiagFlag('touchTrace')`. `window.__diag_getLockDepth` + `window.__diag_getAudioCtxState` exposed for the overlay. All zero-footprint in production.

## User preferences

- Premium / minimalist aesthetic — no flashing reward spam, no cash-grab feel.
- Build vertically over time — phases extend, never destabilize prior systems.
- No placeholder/mock data — features either ship real or are clearly labeled "coming soon".
- "Coming soon" features should never have fake data behind them (e.g. ambient audio was previously labeled coming soon — Phase 10.1 actually built it via WebAudio synthesis, not stub MP3s).
