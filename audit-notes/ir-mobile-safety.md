# SV Illustration Rare (IR) Validation & Mobile Safety Observations

## Validation Results

* SV Illustration Rare cards: New IR visual treatment applied successfully and constrained to Showcase Tier.
* Common/Rare/Holo/SIR/Hyper cards: Unchanged.
* Binder / Grids / Thumbnail tier: Unchanged (Protected by `[data-render-tier="showcase"]` scoping).
* GPU Guards and CPU Kill Switches remain intact (via the HoloController capability system).

## Mobile Safety Observations

* **Blend Modes Introduced:** `screen`, `hue`, `hard-light` for `.card__shine`, and `soft-light` for `.card__shine::after`. `.card__glare` uses `overlay`, and `.card__glare::after` uses `screen`. Total blend operations: 6 (vs SIR's 7+).
* **Texture Count:** 1 (`grain.webp`) used twice. No heavy masks or external webp sequences (like `iri7`, `iri8`).
* **Compositing Layers:** `card__translater`, `card__glare`, `card__glare::after`, `card__shine`, `card__shine::after`. Minimal DOM structure added (relied on `::after` pseudo-elements to avoid `.card__glare2`).
* **Estimated Mobile Impact:** Medium. Safer than SIR due to the lack of luminance masking and exclusion blend modes. Smooth interactions maintained via `HoloController` bounds caching and requestAnimationFrame debouncing. No runaway loops detected.
