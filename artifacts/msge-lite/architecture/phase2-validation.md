# Phase 2: Render Architecture Validation

## 1. Render Architecture Audit

### Card Locations & Tiers
1. **THUMBNAIL Locations:**
   - Binder (`favoritesScreen.js`)
   - Collection Grid (`cardRenderer.js`)
   - Market Graph List (`marketScreen.js`)
   - Archive Slabs (`slabRenderer.js` non-fullscreen)
2. **INTERACTIVE Locations:**
   - Currently none explicitly use INTERACTIVE (though `data-rb-interactive` might map to it in future states).
3. **SHOWCASE Locations:**
   - Pack Reveal (`cardRevealAnimator.js`)
   - Market Showcase Card (`marketScreen.js`)
   - Slab Viewer (`slabViewer.js`)

### Architecture Mechanisms
4. **Capability Consumption:** Capabilities are consumed via `getTierCapabilities(tierNode.dataset.renderTier)`. Components read the capability flags (`tilt`, `glare`, `holo`, `particles`) to decide whether to spawn DOM nodes or execute effects.
5. **HoloController Attachment:** The `HoloController` searches the DOM for elements with `data-rb-interactive="true"`. For each matched card, it initializes pointer event listeners (if `tilt` capability is present) and registers an active state to update spring values via a single shared `requestAnimationFrame` loop.
6. **GPU Guards:** GPU DOM Guard operates via `style.css` which forces `display: none !important;` on heavy layers (`.card__glare`, `.card__shine`, `.reverse-holo-overlay`, etc.) for any element nested under `[data-render-tier="thumbnail"]`.

## 2. Showcase Environment Selected
**Pack Reveal**
- Chosen because it isolates exactly one active card.
- It provides the safest debugging environment with minimal GPU risk during validation.

## 3. DOM Structure Findings
- Showcase cards in Pack Reveal (`cardRevealAnimator.js`) do not currently have the full Simey DOM structure. They use `.overlay-card-wrapper` -> `.overlay-card-inner` -> `.overlay-card-front`/`.overlay-card-back-face`.
- To align with the architecture, we will augment the structure to include `.card__translater`, `.card__image`, `.card__glare`, and `.card__shine` directly inside the existing wrapper, without completely forking the card system.

## 4. Tilt Validation
- **SHOWCASE:** In Pack Reveal, the card is wrapped with `data-render-tier="showcase"` and will be marked `data-rb-interactive="true"`. `HoloController` hooks into pointer events and drives transform updates (`--rb-rotate-x`, `--rb-rotate-y`) via RAF.
- **THUMBNAIL:** Cards in Collection/Binder stay as `thumbnail` and do not have `data-rb-interactive="true"`. Furthermore, even if they did, `HoloController` reads `getTierCapabilities(tier).tilt`, which is `false` for `thumbnail`. They receive no listeners and no RAF updates.

## 5. Glare Validation
- A lightweight validation glare will be added to `.card__glare`.
- Driven by `capabilities.glare`.
- Pure `rgba(255, 255, 255, var(--rb-glare-opacity, 0))` via opacity manipulation, avoiding expensive `mix-blend-mode`.

## 6. Shine Validation
- A lightweight validation shine will be added to `.card__shine`.
- Driven by `capabilities.holo` or `capabilities.glare`.
- Uses a simple linear-gradient: `linear-gradient(135deg, transparent, rgba(255,255,255,0.15), transparent)`.
- Opacity scaled by `--rb-shine-opacity, 0`.

## 7. Runtime Validation
- Demonstrated through the Diagnostic Overlay and `HoloController` state.
- Thumbnail cards have no pointer listeners, no RAF loops, and no glare/shine rendering (GPU Guard forces `display: none`).

## 8. Diagnostic Overlay
- A development-only diagnostics panel displays:
  - Render Tier of the tracked card
  - Active Capabilities
  - Number of Active Holo Controllers
  - Pointer Tracking status
  - RAF Loop status
  - Simple rolling average FPS counter
- Located in `ui/diagnosticOverlay.js`.

## 9. Future Attachment Points
- **SV Era Effects:** Attach inside `.card__shine` or as sibling layers, gated by `data-era="sv"`.
- **SWSH Era Effects:** Attach similarly, gated by `data-era="swsh"`.
- **Rarity Masks:** Applied as `mask-image` on specific foil layers within `.card__shine`.
- **AGS Showcase Effects:** Custom layers within the Slab Viewer, driven by AGS tier.
- **Slab Showcase Effects:** Attached to `.slab__translater` or `.slab__case`.

## 10. Validation Pass
- All grids (Collection, Binder, Market, Wishlist, Archive, Favorites, AGS, Pack Reveal) remain functional and retain their original behavior (no regressions). THUMBNAIL tier guardrails continue working to shield bulk grid content from layout shifts.

## 11. Files Changed
1. \`artifacts/msge-lite/architecture/phase2-validation.md\`
2. \`artifacts/msge-lite/ui/HoloController.js\`
3. \`artifacts/msge-lite/ui/cardRevealAnimator.js\`
4. \`artifacts/msge-lite/style.css\`
5. \`artifacts/msge-lite/ui/diagnosticOverlay.js\`
