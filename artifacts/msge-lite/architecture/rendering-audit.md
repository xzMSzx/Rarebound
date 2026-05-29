# Phase 1: Render Tier Architecture Audit

## 1. Render Entry Point Audit
- **Collection Grid** (`ui/cardRenderer.js` -> `createCardElement`): Renders many static cards in a grid.
- **Binder View** (`main.js` -> `renderBinderPage`): Renders paginated grids of slots/cards.
- **Pack Reveal** (`ui/cardRevealAnimator.js` -> `buildCard`): Animates single pack openings.
- **Card Detail Modal** (`main.js` -> `buildCardDetailHTML`): High-detail single card view.
- **AGS Tiles/Compact** (`ui/slabRenderer.js` -> `renderSlab`): Lists of graded cards (Market/Archive).
- **AGS Premium Viewer** (`ui/slabRenderer.js` -> `renderPremiumSlab`): High-detail graded view.
- **Favorites** (`ui/favoritesScreen.js` -> `renderFavoriteTile`): Static tiles.
- **Market** (`ui/marketScreen.js` -> `renderRowHTML`): List rows with tiny thumbnails.

## 2. Tier Mapping Summary
- **THUMBNAIL:** Collection Grid, Binder Grid, AGS Tiles, Favorites Tiles, Market Rows.
- **INTERACTIVE:** Future-proofing for medium quality (e.g., small interactive widgets or secondary modals).
- **SHOWCASE:** Pack Reveal, Card Detail Modal, AGS Premium Viewer.

## 3. Capability Architecture
Instead of checking raw tier names, features will check explicit capabilities:
- `tilt`: Should the CPU track pointer events and calculate physics springs?
- `glare`: Should glare overlays be visible?
- `holo`: Should full heavy blend-mode holographic layers be rendered and animated?

## 4. Guard Implementations
- **CPU Guard:** `HoloController` will read the tier capability before attaching event listeners or adding items to the `RAF` loop.
- **GPU Guard:** CSS will use `[data-render-tier="thumbnail"]` to aggressively `display: none` heavy visual layers.
