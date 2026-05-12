# GEMINI.md — Rarebound Project Context

## Core Identity & Tech Stack
- **Project:** Rarebound (Digital TCG Collection Sim)
- **Stack:** Vanilla JS / Vite (No frameworks like React/Vue).
- **Environment:** Local Vite environment (v1.6.0).
- **State:** Persistent `localStorage` only, using `tcg_*` namespacing.
- **UI Pattern:** Imperative DOM building via string templates and `innerHTML`.

## Architectural Rules (Strict)
- **Vanilla Only:** Do not suggest JSX, React hooks, or Radix UI components.
- **TDZ Safety:** All `const/let` declarations must be hoisted above the top-level `renderVendorHub()` call to prevent iOS WebKit ReferenceErrors.
- **iOS Gestures:** Use `iosTap(el, handler)` for all click interactions. Handlers must NOT destructure event arguments (e.g., use `() => {}`, not `(e) => {}`).
- **Economy:** Centralized in `economyManager.tickEconomy()`. Do not scatter logic.
- **Visuals:** Premium minimalist aesthetic. Use the `.rb-pill` primitive for UI navigation and tabs.

## Key Systems Context
- **AGS (Grading):** Registry-first tab nav. Slabs use the "museum-grade nested-shell" design in `slabRenderer.js`.
- **Quality:** Per-copy hidden quality metadata generated in `runPackOpening`.
- **Favorites:** Pure cosmetic identity (no gameplay buffs). Stored as `Set<cardId>` in `tcg_favorites`.
- **Recovery Mode:** Failsafe triggers when balance < $8.

## File Map for Quick Reference
- `main.js`: Top-level wiring & screen rendering.
- `data/`: Managers for economy, grading, and storage.
- `ui/`: Screen-specific UI logic and overlay controllers.
- `style.css`: Unified styles (check the `.premium-slab` namespace for grading visuals).

## Do Not Edit
- `ui/packOpeningController.js`
- `ui/cardRevealAnimator.js`
- `simulations/packSimulation.js`
- `data/rarityMapper.js`

## Game Overview & Features
Rarebound is a high-end Digital TCG simulator focused on a "Living Economy" and "Museum-grade" collecting.
- **Vendors:** 4 distinct shopkeepers with world events and reputation levels.
- **The Broker:** Weekend-only vendor (Fri-Sun) for high-end chase cards.
- **AGS Grading:** A certification system that adds value based on hidden "Grade Seeds" (1.0 to 10.0).
- **Slabs:** Archiving a card puts it in a "Premium Slab" view, removing it from the binder.
- **Economy:** Market values drift every 30s based on rarity-bound volatility.
- **Recovery Mode:** A "safety net" UI that appears if the player goes broke ($ < 8).

## Current Milestone: v1.6.0 (AGS UX/UI Refinement)
We are currently focused on:
- Tabbed navigation in the AGS screen (Registry, Active, Eligible).
- Compact "Registry Tiles" that show Value Deltas (Raw vs. Graded).
- Visual "Acrylic Edges" and grade medallions for archived cards in binders.
- The "Favorite Collection" showcase—a standalone screen for the player's best cards.

## Core State (localStorage)
- `tcg_player_v2`: XP, Name, Balance.
- `tcg_collection_v2`: The main card inventory.
- `tcg_ags_submissions`: Ongoing and completed grading jobs.
- `tcg_favorites`: A simple array of favorited card IDs.