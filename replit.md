# RAREBOUND — Digital Trading Card Collection

A vanilla JS / Vite Pokémon TCG collection sim with a four-vendor living economy, dynamic market values, favor + reputation progression, mystery boxes, a chase-card Broker, rotating Collector Requests, Recovery Mode safety net, Collection Prestige, Vendor World Events, AGS · Archive Grading Services slab system, and the Favorite Collection. Premium minimalist aesthetic, mobile-first.

**Current version: 1.6.0** ("AGS UX/UI Refinement + Collection Flow Update" — Archive Services screen restructured around a Registry-first tab nav; certified slabs now show raw → archive value deltas; binders carry per-tier grade medallions and acrylic edges on archived cards; card detail surfaces an "Archived copy available" section with a direct slab viewer link; Collection header simplified to a pill row [All · Favorites · Wishlist · Archived]).

## v1.6.0 Changes (AGS UX/UI Refinement + Collection Flow Update)

This is the 17-part doc the user explicitly approved. Visual + flow polish; no economy changes, no new persistent state.

**Data helpers** — Three pure-read additions:
- `getSlabsForCard(setId, cardId)` and `getHighestSlabForCard(setId, cardId)` in `agsSubmissionManager.js` walk the completed-slabs registry and (for the latter) pick the highest tier rank.
- `gradedDeltaForSlab(slab, rawValue)` in `agsMarketIntegration.js` returns `{ raw, graded, delta, deltaPct }` for compact raw → archive UI.
All three are pure functions, safe with empty registry, no localStorage churn.

**AGS screen — Registry-first tab nav** — `archiveServicesScreen.js` rewritten around `_state.activeTab` (default `'registry'`). Hero panel + new pill nav `[Registry · Active · Eligible]` (counts live in pill chip) + a single rendered tab panel + the always-visible About AGS footer. Tab switches cross-fade via a 220ms `agsTabFade` keyframe, gated by `prefers-reduced-motion`. Submitting a card auto-jumps to Active so the player sees what they queued. New `setAgsActiveTab(tab)` export lets the Collection page deep-link to Registry.

**Registry tile redesign** — New `.registry-tile` (built imperatively in `buildRegistryTile()`): top header (AGS badge + grade label + serial), center slab host, bottom value strip (`Raw $X` → `Archive $Y` + `±N%` chip). Per-tier top accent stripe. Compact slab still mounts via `renderSlab()` — no slab visual changes.

**Binder grade badges + acrylic edge** — In `renderBinderPage()`, slots whose card has a slab in the registry get `.has-archived` + `.archived-tier-{id}` classes plus an absolutely-positioned `.binder-grade-badge` medallion in the top-right corner. The `::before` pseudo-element on the slot paints a soft per-tier glow border so a binder page reads at a glance. Tier colors mirror the slab system (silver / blue / gold / lavender / spectral / copper).

**Card detail "Archived copy available"** — `openCardDetail()` now inserts `.cdp-archive-section` between the divider and the value rows whenever `getSlabsForCard()` returns ≥1 slab. Shows top grade label + serial + raw → graded value + a `View Archive Slab →` CTA that closes the modal and opens `slabViewer.js` with `rawValue` passed through. Per-tier border accents.

**Collection header + filter pills** — Header simplified to `back / title / spacer` (no header-level Wishlist/Favorites buttons). New `.collection-filters` `.rb-pill-row` mounted directly under the header by `renderCollectionFilters()`. Pills: `All · ★ Favorites · ☆ Wishlist · ⬢ Archived`. They're navigation pivots, not list filters: Favorites and Wishlist open their dedicated screens; Archived calls `setAgsActiveTab('registry')` then `openAgsScreen()`. Old `#favorites-btn` / `#wishlist-btn` bindings kept behind `if (el)` legacy guards so nothing breaks if any cached HTML still has the old buttons.

**Shared pill primitive** — New `.rb-pill` / `.rb-pill-row` CSS used by both the AGS tab nav and the Collection filters. Active state uses the brand gold gradient; inactive is muted charcoal. All transitions sit in the 180–250ms cubic-bezier window with reduced-motion safety.

**Bonus fix** — `computeAgsEntrySummary` was calling `lockedCopiesFor(...)?.size ?? 0`; the function returns a number, not a Set, so the optional-chain always produced `undefined → 0` and the eligible count was overcounted. Now `Number(lockedCopiesFor(...)) || 0`.

**No structural changes** — `agsSubmissionManager` storage shape, slab data shape, prestige scoring, reveal overlay, and submission flow are all unchanged. Help center adds 4 v1.6.0 topics.

## v1.5.2 Changes (Premium Slab Graduation, prior release)

Visual-only release. The slab visual system used inside `openSlabViewer()` (full-screen inspection view, opened from the binder slab tile, archive registry, and reveal overlay) has been replaced with the museum-grade nested-shell design developed in `artifacts/mockup-sandbox/src/components/mockups/ags-slabs/`.

**New: `renderPremiumSlab(slab, apiCard)` in `ui/slabRenderer.js`** — emits the nested HTML structure: `.premium-slab > .premium-slab__outer-shell > .premium-slab__inner-shell > [label panel, gem, card chamber, subgrades panel, pin]` plus light overlay, edge refractions, specular highlight, and four corner blooms. Includes per-tier short labels (`AGS_10` → ARCHIVE PRISTINE, `AGS_9_5` → PRISTINE, etc.), barcode strip, AGS laurel SVG medal, and dedicated archive-details column inside the slab itself (date graded, service level, turnaround, serial). The compact-tile `renderSlab()` and `slabHTML()` exports are untouched.

**`ui/slabViewer.js` — switched to premium slab** — imports `renderPremiumSlab` and mounts it into `.slab-viewer__slab-wrap`. Because the premium slab now contains the full grade breakdown internally, the viewer's first side panel (Grade Breakdown) is hidden via CSS (`.slab-viewer .slab-viewer__panel:first-child { display: none }`). Valuation and Archive Notes panels remain — Valuation is dynamic ($raw × multiplier), Archive Notes are kept as a redundant safety net.

**`style.css` — appended ~470 lines of premium-slab CSS** under the `.premium-slab` namespace so nothing collides with the legacy `.ags-slab__*` compact-tile styles. Per-tier escalation: AGS 6 graphite → 7 silver → 8 cool blue → 9 gold → 9.5 lavender → 10 spectral white. Per-tier overrides cover outer-shell rim color, panel + chamber frames, label/medal grade-number gradients, gem core color, laurel stroke, and corner refraction tints. Sheen overlay disabled for AGS 6 and gated by `prefers-reduced-motion`.

**No structural changes** — `agsSubmissionManager`, `agsGradingEngine`, `agsMarketIntegration`, `cardQualityManager`, prestige scoring, and the reveal overlay are all unchanged. The slab data shape is identical; only the visual presentation in the full-screen viewer is upgraded.



## v1.5.1 Changes (Collection UX & AGS Navigation Refinement)

This is a UI/UX refinement release — no new mechanics. The goal is to reduce visual clutter on the top nav, give AGS a more institutional feel, and add a personal-ownership layer (Favorites) without coupling it to gameplay.

**Removed: AGS top-bar button** — `#ags-btn` deleted from `index.html`, the previous click/iosTap wiring in `main.js` replaced with a comment block. The top bar now contains only `My Collection`, `Market`, `Stats`, and the balance display. AGS is treated as a prestige destination, not a primary gameplay tab.

**New: AGS entry panel on the Collection screen** — `renderCollectionAgsEntry()` in `main.js` paints a charcoal-and-gold panel (`.ags-entry-panel`) into `#collection-ags-entry`, placed above the binder list. Shows Eligible / Archived / Top Grade stats and a full-width "Enter Archive Services" CTA. Both the panel and the CTA route to `openAgsScreen()`. Stats are computed by `computeAgsEntrySummary()` which combines `getAgsStats()` with a derived eligible-copies count (owned Double Rare+ minus copies currently locked in active submissions via `lockedCopiesFor`).

**New: AGS card on the Stats screen** — Same data, more compact (`.stats-ags-card`), prepended above the Collector Rank card. Tap-enabled with iOS keyboard support.

**New: Favorite Card system** — `data/favoritesManager.js` mirrors `wishlistManager.js`: a `Set<string>` of card IDs persisted as JSON under `tcg_favorites`. Pure collector identity — never gates content, never grants currency, never grants prestige. Public API: `getFavorites`, `getFavoriteCount`, `isFavorited`, `addFavorite`, `removeFavorite`, `toggleFavorite`.

**New: Favorite toggle on card detail** — Owned cards in the card detail modal now show a heart button (`.cdp-fav-btn` ♡ → ♥) in the new `.cdp-header-row`. Soft gold glow when favorited, neutral border when not. Toggling logs `favorited` / `unfavorited` activity and refreshes any open Favorites screen.

**New: Favorites screen** — `ui/favoritesScreen.js` + `#favorites-screen` div. A premium card grid (not a binder), sorted: graded slabs first → higher rarity → higher market value. Each tile is a square-aspect card thumbnail with rarity + market value beneath; graded copies show a small grade badge in the corner. Empty state for users with no favorites yet. Opened from a new `[★ Favorites]` button next to `[☆ Wishlist]` in the Collection header.

**New: Favorited-card sell confirmation** — `openSellModal` in `main.js` checks `isFavorited(apiCard.id)` and renders an additional `.sell-warning--fav` banner ("Part of your Favorites Collection") above the vendor list. Confirming a sell on the last copy of a favorited card auto-removes it from favorites so the showcase never references unowned cards.

**AGS page hierarchy cleanup** — `ui/archiveServicesScreen.js` no longer renders the duplicate "ARCHIVE SERVICES" page header. The header row is now minimal (`.ags-screen-header--minimal`) — just the Back button and spacers — and the existing AGS hero card becomes the true page header. Section spacing increased via `.ags-screen-body--spacious` (`margin-top: 36px` between sections).

**Stat-card alignment fix** — All `.stats-grid .stat-card` cells now use a flex column with `min-height: 92px`, plus min-heights on `.stat-value` (32px) and `.stat-label` (28px). The "Most Collected" card with its long set names no longer breaks the row baseline.

**Activity Feed types** — `favorited` (♥), `unfavorited` (♡) added to `ACTIVITY_ICONS` in the hoisting zone (above the top-level `renderVendorHub()` call) so the iOS WebKit TDZ rule is preserved.

**Help center** — 3 new topics: Favorite Collection, Archive Services Entry, Card Preservation.

_See `CHANGELOG.md` for v1.5.0 (AGS · Archive Grading Services), v1.4.0 (Collector Prestige Foundations) and earlier release notes. Trimmed from this file in v1.5.1 to keep the active surface scannable._

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
├── main.js                          ← top-level wiring + UI screens + runPackOpening + AGS reveal queue + AGS entry panels (v1.5.1)
├── index.html                       ← v1.5.1 — AGS top-bar button removed; #favorites-screen + #collection-ags-entry + .collection-favorites-btn added
├── style.css                        ← v1.5.1 styles appended (entry panels, favorites screen, fav heart, stat-card alignment, AGS minimal header)
├── data/
│   ├── settingsManager.js           ← settings store + APP_VERSION (1.5.1)
│   ├── hapticManager.js, ambientAudioManager.js, devAccess.js
│   ├── mysteryBoxManager.js, economyManager.js, vendorManager.js, reputationManager.js, sellingManager.js
│   ├── collectionManager.js, marketValue.js, marketHistory.js, chaseManager.js
│   ├── stipendManager.js, recentHits.js, packStore.js, activityFeed.js
│   ├── requestManager.js, milestoneManager.js
│   ├── distressManager.js, recoveryManager.js, emergencyRequestManager.js
│   ├── cardQualityManager.js        ← v1.5.0 — PER-COPY hidden quality (tcg_card_quality_v2)
│   ├── agsGradingEngine.js          ← v1.5.0 — pure tier/multiplier resolver
│   ├── agsSubmissionManager.js      ← v1.5.0 — submission queue + tick + serial numbers
│   ├── agsMarketIntegration.js      ← v1.5.0 — graded valuation helpers
│   ├── prestigeManager.js, archiveHistoryManager.js
│   ├── vendorEventsManager.js, collectionValueHistory.js
│   ├── wishlistManager.js, cardPoolManager.js, rarityMapper.js
│   └── favoritesManager.js          ← v1.5.1 — Set<cardId> under tcg_favorites
├── state/playerState.js
├── ui/
│   ├── bootScreen.js, settingsScreen.js, helpScreen.js, marketScreen.js, utilityDock.js
│   ├── mysteryBoxOverlay.js
│   ├── slabRenderer.js              ← v1.5.0 compact tile + v1.5.2 renderPremiumSlab() museum-grade nested shell
│   ├── slabViewer.js                ← v1.5.2 — full-screen viewer mounts premium slab + Valuation/Notes panels
│   ├── agsRevealOverlay.js          ← v1.5.0 — staged cinematic certification
│   ├── agsSubmissionModal.js        ← v1.5.0 — 3-tier submission UI
│   ├── archiveServicesScreen.js     ← v1.5.0 / v1.5.1 — minimal header + spacious body
│   ├── favoritesScreen.js           ← v1.5.1 — premium card grid showcase
│   └── (DO NOT EDIT) reveal/audio/pack controllers
└── simulations/packSimulation.js    ← RNG/pity (DO NOT EDIT)
```

## Architecture decisions

- **No framework** — DOM strings + event handlers. Keeps reveal/audio systems untouched.
- **All state in localStorage** under namespaced `tcg_*` keys.
- **Centralized economy engine** — `economyManager.tickEconomy()` orchestrates refresh ticks; never scattered.
- **Shared pack-opening helper** — `runPackOpening(setId, vendor, opts)` in main.js handles balance debit, animation, card grant, favor, reputation, recent hits, set completion, per-copy quality metadata generation, prestige hit detection + overlay, wishlist + first-of-a-kind archive entries, value history snapshot.
- **Per-copy quality (v1.5.0)** — `addCardToCollection` is interleaved with `ensureQualityForCopy` inside the same `forEach` so each call captures the just-incremented count as `copyN`. Two separate passes would lose the per-copy ordering for cards pulled multiple times in one pack.
- **AGS submission queue (v1.5.0)** — `tickSubmissions()` runs from the existing 30s `setInterval`. Newly-completed slabs are queued through `enqueueAgsReveals()` which fires `showAgsRevealOverlay()` one at a time.
- **AGS valuation (v1.5.0)** — `agsMarketIntegration.gradedValueFromRaw()` is purely derived from raw market value × tier multiplier × `hiddenGradeSeed`. No persisted graded prices.
- **Slab visuals (v1.5.0)** — pure CSS via per-tier classes. Only one optional foil shimmer keyframe and the hero sweep, both gated by `prefers-reduced-motion`.
- **First copies auto-lock** in `collectionManager`. Selling a locked last-copy requires explicit unlock confirmation in `sellingManager`. AGS submissions also lock the specific copy via `agsSubmissionManager.lockedCopiesFor()`.
- **Card values persist + drift** — `marketValue.tickMarketValues(trend)` walks each value within rarity-bound volatility, biased by the active trend.
- **Refresh cycle**: `REFRESH_INTERVAL_MS = 30 * 60 * 1000` (dev). Architecture supports 24h by changing one constant.
- **Broker time gate**: `isVendorOpen('broker')` returns true only on Fri/Sat/Sun.
- **Reputation never decreases** — gained from packs, discoveries, rare pulls, set completions (+250). 7 ranks: Rookie → Collector → Advanced → Elite → Master → Archive Curator → Legendary.
- **Sandbox Mode** — when Infinite Balance is on, `reputationManager.addReputation` short-circuits to a no-op so casual testing never contaminates rank progression.
- **Recovery Mode** — `data/recoveryManager.js` orchestrates a non-destructive failsafe layer when balance < $8. `tickRecovery()` advances 45-min focus rotation + cleans up post-recovery state from the 30s `setInterval`.
- **Vendor World Events** — `tickVendorEvents()` runs from the same 30s loop. Effects honored at three points: `renderVendorPackTile` for `packDiscountPct`; `reverseHoloBoost` / `volatilityMult` / `chaseStockBoost` are exposed via `getVendorEventEffect(vendorId)`.
- **Collection Prestige** — pure derivation from `collectionManager` + `cardPoolManager` + `milestoneManager.getClaimedMilestones()` + a small bonus pool (`tcg_prestige_bonus`). v1.5.0 contributors: AGS 9.5 → +25, AGS 10 → +60, BLACK LABEL → +200.
- **Archive History** — chronological collector log with `key`-deduped first-of-a-kind events. Day count derived from `day0`. 200-entry cap.
- **Settings hooks** — `setSettingsHooks({ onBalanceChanged, onVendorsChanged, onMarketRefreshed, onReputationReset, onInfiniteToggled })` called from main.js.
- **Favorites are pure cosmetic identity (v1.5.1)** — `favoritesManager` is a single Set of card IDs. It never debits balance, never grants prestige, never gates content. The only side-effects are: a soft warning banner in the sell modal and an auto-removal hook when the player confirms selling their last copy of a favorited card. Designed to outlive surfacing changes — slabs, binders, and showcase galleries can all derive from the same Set.

## Storage keys

- `tcg_player_v2`, `tcg_collection_v2`
- `tcg_market_values`, `tcg_market_meta`, `tcg_market_history`
- `tcg_economy`, `tcg_favor`, `tcg_vendor_stocks`, `tcg_reputation`
- `tcg_chase`, `tcg_broker_inv`, `tcg_stipend`, `tcg_recent_hits`, `tcg_activity`
- `tcg_settings`, `tcg_dev_access`, `tcg_infinite_balance`
- `tcg_box_offerings`, `tcg_vendor_requests`, `tcg_emergency_requests`
- `tcg_milestones`, `tcg_recovery_state`
- `tcg_card_quality` (v1.4.0 legacy — auto-migrated lazily) → `tcg_card_quality_v2` (v1.5.0 per-copy fingerprints)
- `tcg_ags_submissions` — v1.5.0 `{ active, completed, nextSerial: 1001 }`
- `tcg_prestige_bonus`, `tcg_archive_history`, `tcg_vendor_events`, `tcg_value_history`
- `tcg_wishlist`, `tcg_stats`
- `tcg_favorites` — **v1.5.1** `string[]` (serialised Set of card IDs)

## Gotchas

- DO NOT modify `ui/packOpeningController.js`, `ui/cardRevealAnimator.js`, `ui/fullscreenOverlay.js`, `ui/audioManager.js`, `simulations/packSimulation.js`, or `data/rarityMapper.js`.
- All card images come from `pokemontcg.io` — no local image assets except pack art under `public/packs/`.
- Boot screen: `loadPlayerState()` and `initEconomy()` MUST stay synchronous at top-level.
- Ambient vendor audio is fully synthesized at runtime (WebAudio) — never add audio asset files.
- `runPackOpening` is the single source of truth for pack flow. Mystery boxes pass `skipSpend: true` and a per-pack `favorBasis`.
- `spendBalance` honors infinite balance — UI pre-checks should use `isInfiniteBalance() || getBalance() >= price`.
- **`.screen.hidden { display: none; touch-action: none }` and `#card-detail-modal.hidden` / `#sell-modal.hidden` (specificity 1-1-0) are essential — do not remove.** See v1.2.x notes in `CHANGELOG.md` for the iOS WebKit gesture-recognizer rationale.
- **`const`/`let` bindings read inside `renderVendorHub()` or `updateRankStrip()` MUST be declared above the top-level `renderVendorHub()` call.** Function declarations hoist; `const`/`let` do not — accessing a `const` before its declaration line throws a TDZ ReferenceError that silently kills module init on iOS WebKit. v1.5.1 additions to `ACTIVITY_ICONS` (`favorited`, `unfavorited`) live in the same hoisted object as v1.5.0's `ags_*` entries. v1.5.1 helpers `computeAgsEntrySummary` and `renderCollectionAgsEntry` are function declarations, so they hoist; the `_favBtn` IIFE-style binding lives at the imperative bottom of the module and is safe.
- **`iosTap(el, handler)` is called with ZERO args** — handlers must not destructure an event arg.
- **v1.5.0 — Per-copy quality is exposed only through AGS.** Never surface `getOrCreateQuality()` results directly to the player UI outside the AGS screen, the submission modal's atmospheric hint, or post-grading slab views.
- **v1.5.0 — Slabs use CSS-only animation.** No canvas, no JS-driven per-frame rendering.
- **v1.5.0 — Prestige is still cosmetic.** AGS pristine bonuses feed the prestige score but never gate content.
- **v1.4.0 — Vendor event effects are additive, capped.** `packDiscountPct` from a world event combines with `_tempVendorDiscounts` and is hard-capped at 50% in `renderVendorPackTile`.
- **v1.5.1 — Favorites never gate content.** The favorites Set is purely cosmetic identity. Don't add favorite-conditional payouts, milestones, prestige bonuses, or unlocks. The whole point is "these are MY cards" — nothing else.
- **v1.5.1 — AGS is no longer in the top nav.** Entry points are `#collection-ags-entry` (Collection page panel) and `#stats-ags-entry` (Stats screen card). Both call `openAgsScreen()` which is hoisted in the AGS screen-hooks zone above `renderVendorHub()`. Do not re-add an AGS top-bar button.

## Product

- **Boot screen** — RAREBOUND identity overlay with rotating preload labels.
- **Vendor Hub**: 4 themed vendors with subtle world-event banners.
- **Mystery Boxes**: Midnight Bundle, Vintage Archive Crate, Collector Cache.
- **Recovery Mode**: emergency requests + relief stipend safety net.
- **AGS · Archive Grading Services**: per-copy hidden quality, three submission tiers, suspenseful reveal ceremony, slab UI, market multipliers, public registry. **Entry via Collection page panel + Stats card (v1.5.1) — no longer in top nav.**
- **Favorite Collection (v1.5.1)**: heart-toggle on card detail, dedicated showcase screen, sell-time soft warning.
- **Collector Prestige**: museum-style tier label on the Stats screen.
- **Archive History**: private "Day N" collector log on the Stats screen.
- **Collection Value History**: daily snapshots + lifetime peak + sparkline.
- **Vendor World Events**: rotating atmospheric events with real economic effects.
- **Prestige Pulls**: tasteful post-pull moment for Illust/Hyper/Special-Illust/wishlist/chase hits.
- **Daily chase**, **market screen**, **daily stipend**, **recent hits rail**, **collection binders** with evolution chains, **selling system**, **reputation** (7 ranks), **wishlist**, **statistics dashboard**.

## User preferences

- Premium / minimalist aesthetic — no flashing reward spam, no cash-grab feel.
- Build vertically over time — phases extend, never destabilize prior systems.
- No placeholder/mock data — features either ship real or are clearly labeled "coming soon".
- "Coming soon" features should never have fake data behind them.
