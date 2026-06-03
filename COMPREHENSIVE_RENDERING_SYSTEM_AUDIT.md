# COMPREHENSIVE RENDERING SYSTEM AUDIT

## 1. Card Data Pipeline
**Trace:**
*   **raw card data:** Arrives from `engine.state.cards` inside `runPackOpening` (in `main.js`). Legacy fields like `rarity` (e.g. "rare", "epic") exist here.
*   **pack generation:** Handled in `runPackOpening` using `engine.stepSimulation()`. Cards are sliced (last 10 cards).
*   **augmentCards():** Called in `main.js`. It fetches a `poolCard` from the vendor/set.
    *   *Rarity source:* `poolCard.rarity` and `poolCard.apiRarity`.
    *   *VisualProfile state:* Appends `visualProfile: getCardVisualProfile(visualCard)`. The `visualCard` used here takes its rarity from `poolCard.apiRarity`. It also sets `rarityType: poolCard.rarity`.
*   **card storage:** Saved to a session object and set via `setPendingSession(session)` in `main.js`.
*   **reveal pipeline:** Traced via `playPendingSession()` -> `openPackOverlay(newCards, packNumber, session.currentRevealIndex)`.
*   **overlay pipeline:** Managed in `ui/fullscreenOverlay.js` by `doReveal()`.
*   **collection pipeline:** Managed in `ui/cardRenderer.js` via `createCardElement()`.

## 2. Visual Profile Architecture
**Usages:**
*   **`getCardVisualProfile()`:** Called in `augmentCards` (`main.js`), `getCardVisualDataset` (`cardVisualMapper.js`), `applyCardVisualDataset` (`cardVisualMapper.js`), `getVisualRarity` (`fullscreenOverlay.js`), `createCardElement` (`cardRenderer.js`), `revealCard` (`cardRevealAnimator.js`).
*   **`getVisualRarity()`:** Used in `fullscreenOverlay.js` for checking suspense and rendering the skip summary.
*   **`card.visualProfile`:** Referenced throughout using fallback `??` operators.
*   **`getCardVisualDataset()`:** Used in `marketScreen.js` and `main.js`.
*   **`applyCardVisualDataset()`:** Used in `cardRevealAnimator.js` and `slabRenderer.js`.

**Determination:**
*   *Single source of truth:* Intended to be `getCardVisualProfile(card)` in `data/cardVisualMapper.js`, outputting an `{ era, rarity }` object.
*   *Duplicate computations:* All renderers (`cardRenderer.js`, `fullscreenOverlay.js`, `cardRevealAnimator.js`) attempt to recalculate the profile if they suspect it's missing using `?? getCardVisualProfile(card)`.
*   *Legacy paths:* `card.rarity` (the engine 4-tier rarity) and `card.rarityType` (the REAL Pokémon rarity set in `augmentCards`) are still piped directly into rendering logic.
*   *Conflicting paths:* The most significant conflict is that the new `visualProfile` determines the visual tier (e.g., `sir`, `ir`, `hyper`), but legacy renderers still look for `realRarity` (which is `card.rarityType`) or `rarity` (the 4-tier string) to perform logic (e.g. gating holos).

## 3. Reveal Rendering Architecture
**Trace (Slot 1 to 10):**
The reveal animation orchestrates through `ui/fullscreenOverlay.js`.
*   **Slot 1-10:**
    *   *Renderer used:* `ui/cardRevealAnimator.js` (`revealCard` and `renderBack`).
    *   *Rarity source:* In `fullscreenOverlay.js`, `const rarity = getVisualRarity(card);` calculates the *visual* rarity. It then calls `revealCard(rarity, isSuspenseCard && hasSuspense, card.imageUrl ?? null, card.isReverseHolo === true, card.rarityType ?? card.rarity, card)`.
    *   *Symbol source:* `RARITY_SYMBOL[rarity]` and `RARITY_LABEL[rarity]` from `cardRevealAnimator.js`.
    *   *CSS classes applied:* `rarity-reveal-${rarity}` inside `renderBack`.
    *   *Dataset values applied:* `applyCardVisualDataset(wrapper, visualCard)` applies `data-era` and `data-rarity` to the `wrapper`.

## 4. Symbol Rendering Architecture
**Trace:**
*   **`ui/cardRenderer.js`:** Uses `RARITY_ICONS[rarity]` to output an SVG badge if the image is missing.
*   **`ui/fullscreenOverlay.js` (Skip Summary):** Uses `RARITY_ICONS[rarity]` to render the badge in `showSkipSummary`. Uses `setRarityStatus` to output the same SVG in the overlay status element.
*   **`ui/cardRevealAnimator.js`:** Uses text symbols (`RARITY_SYMBOL[rarity]`) if image rendering fails or as placeholder text.

**Outputs:**
*   *Source file:* `ui/rarityIcons.js` supplies the SVG logic. Text symbols are hardcoded in `ui/cardRevealAnimator.js`.
*   *Source rarity value:* For `cardRenderer.js` and `fullscreenOverlay.js`, it relies on the `visualProfile.rarity`. For `cardRevealAnimator.js`, it also defaults to the `visualProfile.rarity`.
*   *DOM output:* SVG strings parsing into explicit hex-filled paths (e.g., `diamond`, `star`, `goldStar`).

## 5. CSS Architecture
**Selectors:**
*   `.rarity-reveal-{rarity}`: Found in `style.css` applied to the `.overlay-card-back-face`. Defines linear-gradient backgrounds, text colors, and border colors for the card back placeholder.
*   `.overlay-rarity-{rarity}`: Modifies the color of the status label in the overlay (e.g., `color: #5aabff; font-weight: bold;`).
*   `[data-rarity]`: Standard dataset approach applied to wrappers (e.g. `data-rarity="sir"`).
*   `.rarity-summary-{rarity}`: Applied to the skip summary grid elements in `fullscreenOverlay.js`.
*   `rarity indicators/badges`: Utilizes the explicit SVG definitions from `ui/rarityIcons.js` ensuring visibility.

**Conflicts:**
Because the `visualProfile` logic was partially bolted onto a legacy engine that emitted string values like "Special Illustration Rare", "Rare Holo VMAX", etc., the CSS classes mapping strictly to the normalized keys (e.g. `.rarity-reveal-sir`) fail to trigger correctly if the data passing into the renderer uses the raw or engine-based string (e.g., `.rarity-reveal-Special Illustration Rare` which does not exist). The Codebase recently tried to alias `.rarity-reveal-specialIllustrationRare` to `.rarity-reveal-sir` in `style.css` in commit `0f86e3f` but mixed casing/keys continue to cause bugs depending on which fallback branch executes.

## 6. Regression Analysis
**Git History:**
*   **Last Known Working State:** Commit `3f90c85` ("feat(rendering): implement visual profile routing architecture") introduced the new centralized visual profile (`data/cardVisualMapper.js`). Before this, systems relied on the legacy raw names.
*   **First Broken State:** Commits following `443ee87` ("Refactor card visual profile mapping to use a single source of truth") and `1810598` ("fix(ui): use definitive visual rarity from visualCard in cardRevealAnimator"). These commits attempted to force the use of `card.visualProfile` but introduced nullish coalescing `??` fallbacks that misbehave when encountering unexpected undefined states.
*   **Identify Commits:**
    *   `cardVisualMapper`: `443ee87`, `3f90c85`.
    *   `cardRevealAnimator`: `1810598`, `9fdf097`, `783ea75`.
    *   `fullscreenOverlay`: `9fdf097`, `ada790a`.
    *   `rarityIcons`: `ada790a`.
    *   `cardRenderer`: `9002715`, `857c4ed`.
    *   `style.css`: `0f86e3f`.

**Regression Point:** The exact regression occurred in the sequence of "fixes" starting with `1810598` and the merge `9fdf097`. The attempt to fix slot 10 reveal rarity by overriding the `rarityArg` in `revealCard` using `visualCard?.visualProfile ?? getCardVisualProfile(visualCard)` created a race condition. If `visualCard` is fully populated, it works. But the legacy `packOpeningController.js` and `fullscreenOverlay.js` do not consistently pass a pristine `visualCard` reference that aligns with the raw data string (`rarityArg`).

## 7. Final Report

### A. Architecture Diagram
```
[Engine state / runPackOpening]
       |
       v
[augmentCards (main.js)] -> applies card.visualProfile via getCardVisualProfile()
       |
       v
[playPendingSession] -> [openPackOverlay (fullscreenOverlay.js)]
       |
       |-- getVisualRarity(card) (extracts visualProfile.rarity)
       v
[doReveal]
       |-- passes visual rarity AND card.rarityType (as realRarity)
       v
[revealCard (cardRevealAnimator.js)]
       |-- ignores passed rarityArg and re-extracts visualProfile
       |-- applies dataset
       v
[renderBack]
       |-- uses visual rarity for CSS (rarity-reveal-${rarity})
       |-- uses realRarity for holo logic check
```

### B. Single Source of Truth Recommendation
The `card.visualProfile` attached during `augmentCards` must be the strict, singular source of truth. Renderers must stop invoking `getCardVisualProfile()` entirely. If a card lacks a `visualProfile`, it should throw an error or default explicitly, rather than trying to patch the object ad-hoc during the render pass.

### C. All Duplicate Rarity Systems
1.  `card.rarity` (Engine 4-tier simulation string)
2.  `card.apiRarity` (API raw string)
3.  `card.rarityType` (Set in `augmentCards`, acts as real Pokémon rarity)
4.  `card.visualProfile.rarity` (Normalized visual ID like 'sir' or 'ir')

### D. All Legacy Rarity Systems
*   `ui/packRevealController.js` uses legacy 4-tier engine rarities ('epic', 'legendary').
*   `HOLO_RARITIES` check in `renderBack` (inside `cardRevealAnimator.js`) relies on legacy string matching against `card.rarityType` instead of the boolean capabilities of the `visualProfile`.

### E. All Renderers Involved
1.  `ui/fullscreenOverlay.js` (Orchestrator and Skip Summary)
2.  `ui/cardRevealAnimator.js` (Large Card Flip Renderer)
3.  `ui/cardRenderer.js` (Collection Grid Renderer)
4.  `ui/packRevealController.js` (Legacy Pack Renderer)
5.  `ui/rarityIcons.js` (SVG Builder)

### F. Root Cause of the Current Bug
The root cause is a **pipeline data desynchronization caused by ad-hoc fallbacks**.
`main.js` populates `visualProfile` using an intermediate object (`poolCard`). However, when `fullscreenOverlay.js` invokes `doReveal`, it passes multiple contradicting rarity variables to `revealCard` (visual rarity, engine rarity, real rarity). In `revealCard`, commit `1810598` added logic to override the provided rarity argument by re-calculating `getCardVisualProfile(visualCard)`. This causes a mismatch where the CSS class (`rarity-reveal-X`) generated inside `renderBack` expects a normalized string (e.g. `sir`), but due to fallback branching, it receives an un-normalized string (e.g. `Special Illustration Rare`), breaking the styling.

### G. Recommended Fix Plan
1.  **Remove all renderer fallbacks:** Strip `?? getCardVisualProfile(...)` from `cardRenderer.js`, `fullscreenOverlay.js`, and `cardRevealAnimator.js`. They must simply read `card.visualProfile.rarity`.
2.  **Consolidate Data:** In `main.js: augmentCards`, ensure `card.visualProfile` contains a `.hasHolo` boolean property, derived centrally in `cardVisualMapper.js`.
3.  **Remove `realRarity`:** Remove the `realRarity` argument from `revealCard` and `renderBack`. Gate holo effects solely on `card.visualProfile.hasHolo`.
4.  **Enforce CSS Match:** Ensure that the value generated by `cardVisualMapper.js` exactly maps to the `.rarity-reveal-{rarity}` definitions in `style.css`. Remove legacy alias classes from `style.css` to enforce strict keys.