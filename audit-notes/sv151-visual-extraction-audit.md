# Phase 7A — SV151 Visual Extraction Audit

## 1. File Inventory

| File | Purpose | Target Rarity | Uses Masks? | Blend Modes? | Texture Assets? | SVG Filters? | BG Images? | Est. GPU Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `base.css` | Base variables, positioning, basic shine/glare | N/A (Foundation) | Yes (`--mask`, clip paths) | Yes (color-dodge, overlay) | No | No | Yes (gradients) | Low-Medium |
| `illustration-rare.css` | IR visual profile | `illustration rare` | Yes (`clip-path`) | Yes (screen, hue, hard-light, soft-light, overlay) | Yes (`--grain`) | No | Yes (repeating gradients) | High |
| `ex-special-illustration-rare.css` | SIR visual profile | `special illustration rare` | Yes (`--mask`, `--foil` luminance) | Yes (exclusion, hard-light, overlay, plus-lighter, multiply) | Yes (`--iri7`, `--iri8`, `--iri9`, `--foil`) | No | Yes (repeating gradients) | Very High |
| `ex-full-art.css` | Full Art/Ultra Rare visuals | `ultra rare` | Yes (`--mask`, `--foil`) | Yes (soft-light, hue, hard-light, exclusion) | Yes (`--mask`, `--foil`) | No | Yes (repeating gradients) | High |
| `hyper-rare.css` | HR visual profile (Gold/Hyper) | `hyper rare` | Yes (`--mask`, `--foil` luminance) | Yes (exclusion, hard-light, overlay, plus-lighter, multiply) | Yes (`--iri7`, `--iri8`, `--iri9`, `--foil`) | No | Yes (repeating gradients) | Very High |
| `regular-holo.css` | Standard holo visuals | `rare holo` | Yes (`clip-path`) | Yes (overlay, screen, multiply, luminosity) | No | No | Yes (repeating gradients) | Medium |
| `reverse-holo.css` | Reverse holo visuals | `reverse holo` | No (`clip-path: var(--clip-invert)`) | Yes (soft-light, difference, color-dodge) | Yes (`--foil`) | No | Yes (radial/linear gradients) | Medium |

## 2. SIR Analysis (`ex-special-illustration-rare.css`)

**Glare Layers:**
- `.card__glare`: Uses `multiply` blend mode with a radial gradient based on pointer position.
- `.card__glare2`: Uses `overlay` blend mode, a solid white background, and a luminance mask using `var(--foil)`.

**Shine Layers:**
- `.card__shine`: Adjusts brightness, contrast, and saturation.
- `.card__shine:before`: Uses `overlay` blend mode and repeating linear gradient with `var(--holo)`.
- `.card__shine:after`: Uses `exclusion` and `hard-light` blend modes with linear gradients based on `var(--rotate-x)` and `var(--rotate-delta)`.

**Mask Layers:**
- Uses `-webkit-mask-image: var(--mask)` with luminance masking on `.card__glitter`, `.card__glitter:before`, and `.card__glitter:after`.
- Uses `mask: var(--foil)` with luminance masking on `.card__glare2`.

**Texture Assets:**
- `var(--iri9)` (Hosted externally: `https://poke-holo.b-cdn.net/foils/151/iri-9.webp`)
- `var(--iri8)` (Hosted externally: `https://poke-holo.b-cdn.net/foils/151/iri-8.webp`)
- `var(--iri7)` (Hosted externally: `https://poke-holo.b-cdn.net/foils/151/iri-7.webp`)
- `var(--foil)` (Note: In Simey's repo, `--foil` is typically defined elsewhere per card or defaults. It is *not* `illusion.png` for SIR, as `illusion.png` is only applied in `ex-full-art.css`.)
- `var(--mask)` (Card-specific alpha mask image)

**Blend Modes:**
- `exclusion`, `hard-light`, `overlay`, `plus-lighter`, `multiply`

**CSS Variables:**
- `--shift`, `--glitter-size`, `--rotate-x`, `--rotate-delta`, `--background-y`, `--background-x`, `--holo`, `--iri7`, `--iri8`, `--iri9`, `--mask`, `--card-opacity`, `--pointer-from-center`, `--pointer-from-left`, `--pointer-from-top`, `--pointer-x`, `--pointer-y`, `--foil`

**Dependencies on `base.css`:**
- Relies on `.card__glitter` and `.card__glare2` DOM nodes/styles which are explicitly defined in `public/css/cards/base.css` (lines 247-287 for glitter, 303-323 for glare2) including `display: none` base states, grid layouts, and z-indexes.
- Depends on `base.css` for interactive CSS variables mapping to pointer positions.

## 3. IR Analysis (`illustration-rare.css`)

**Texture Layers:**
- Uses `var(--grain)` in `.card__shine` background-image. (Locally hosted: `/img/grain.webp`)

**Gradients:**
- Uses multiple complex `repeating-linear-gradient` (for sunpillars and angled color stops).
- Uses `radial-gradient` for positional shading and glare mapping.

**Masks:**
- Relies exclusively on `clip-path: var(--clip)` instead of image-based alpha/luminance masks.

**Blend Modes:**
- `screen`, `hue`, `hard-light`, `soft-light`, `overlay`

**Variable Requirements:**
- `--space`, `--angle`, `--imgsize`, `--clip`, `--grain`, `--sunpillar-clr-*`, `--background-x`, `--background-y`, `--pointer-x`, `--pointer-y`, `--card-opacity`, `--pointer-from-center`

**Dependencies:**
- Relies on `base.css` for base `.card__shine` setup and sunpillar color definitions.

## 4. Rarebound Compatibility Audit

**Variables Mapping:**
- **Direct Mappings:**
  - `Simey: --rotate-x` -> `Rarebound: --rb-rotate-x`
  - `Simey: --rotate-y` -> `Rarebound: --rb-rotate-y`
  - `Simey: --card-opacity` -> `Rarebound: --rb-shine-opacity` / `--rb-glare-opacity`
- **Needs Adaptation:**
  - Simey uses `--pointer-x`, `--pointer-y`, `--background-x`, `--background-y`, `--pointer-from-center`, `--pointer-from-left`, `--pointer-from-top`.
  - Rarebound's `HoloController` primarily uses `--rb-rotate-x`/`--rb-rotate-y` (and mapped `--rb-tilt-x`/`y` percentages). We will need to either adapt Simey's math to use our tilt variables, or expand `HoloController` to calculate pointer-distance variables.

**Layer Reusability:**
- `.card__shine` and `.card__glare` map directly to Rarebound's structure.

**Conflicts:**
- Simey's SIR heavily relies on `.card__glitter` and `.card__glare2` nodes. Rarebound only natively tracks `.card__shine` and `.card__glare`.
- Rarebound uses `.card__animator` and `.card__translater` for physical movement; we must NOT import Simey's `.card__rotator` or `.card` 3D transform logic, as it conflicts with Rarebound's physics system.

## 5. Performance Risk Analysis

**SIR Performance:**
- **Texture Count:** 5+ (masks, foils, glitter stages)
- **Blend Mode Count:** 7+ per card
- **Mask Count:** 4 (including heavy luminance masking)
- **Compositing Layers:** High (uses before/after on multiple hardware-accelerated nodes)
- **Repaint Cost:** Very High
- **Safe for showcase?** Yes (but heavy).
- **Safe for mobile?** No. Mask-mode luminance combined with multiple hardware layers and plus-lighter blend modes will likely crash iOS Safari.
- **Requires simplification?** Yes. Fallbacks or simplified alpha-masks are needed for mobile GPU guards.

**IR Performance:**
- **Texture Count:** 1 (`--grain`)
- **Blend Mode Count:** 6+ per card
- **Mask Count:** 1 (cheap `clip-path`)
- **Compositing Layers:** Medium
- **Repaint Cost:** High (complex overlapping repeating gradients updating on frame)
- **Safe for showcase?** Yes.
- **Safe for mobile?** Borderline. Requires CPU/GPU guards, but much safer than SIR.
- **Requires simplification?** Minimal simplification needed, possibly dropping one blend mode or reducing background-size scale complexity on mobile.

## 6. Extraction Plan

**CSS to Copy Directly:**
- The visual blend modes and background-images for `.card__shine` and `.card__glare` in IR and SIR.
- Specific variables defining angles and spaces (e.g., `--angle`, `--space`).

**CSS Requiring Adaptation:**
- Replace `Simey` positional variables (`--pointer-x`, etc.) with `Rarebound` variables (`--rb-tilt-x`, etc.) where possible, or mathematically synthesize them.
- `ex-special-illustration-rare.css` will need `.card__glitter` logic ported into pseudo-elements or we must expand Rarebound's DOM structure to inject these nodes for showcase tiers.
- Convert luminance masks to standard alpha where possible to satisfy iOS constraints.

**CSS NOT to Import:**
- Any physics or transform CSS (`transform: rotateY`, `.card__rotator` rules, `transition` on cards).
- Interactive hover selectors (`.card:not(.interactive):hover`).

**Assets Required:**
- `public/img/grain.webp` (for IR)
- External foil textures (`iri7.webp`, `iri8.webp`, `iri9.webp`) for SIR.
- Specific SVG clip-paths (`--clip`).

**Potential Conflicts:**
- Missing DOM nodes for glitter/secondary glares.
- Missing pointer tracking variables natively in `HoloController`.

## 7. Exact Files Required for Phase 7B
- `public/css/cards/base.css` (for extracting base sunpillar variables and clip-path configurations)
- `public/css/cards/illustration-rare.css` (for IR)
- `public/css/cards/ex-special-illustration-rare.css` (for SIR)
