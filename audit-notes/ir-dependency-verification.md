# Phase 7B — Illustration Rare (IR) Dependency Verification

## 1. DOM Requirements

**Verdict:** `illustration-rare.css` operates entirely using Rarebound's existing DOM structure.

**Analysis:**
- Inspecting `public/css/cards/illustration-rare.css` confirms that it only targets `.card__shine`, `.card__shine:after`, `.card__glare`, and `.card__glare2`.
- Wait, it targets `.card__glare2`. Let's verify if `.card__glare2` is strictly required.
The CSS applies `screen` blend mode and a radial gradient to `.card__glare2`. If Rarebound lacks `.card__glare2`, the secondary glare effect will be lost. To achieve 1:1 parity without extending the DOM, we would need to map `.card__glare2` to `::after` on `.card__glare` (which is standard practice in Rarebound).

**Required Nodes:**
- `.card`
- `.card__shine`
- `.card__shine::after`
- `.card__glare`
- `.card__glare::after` (Alternative mapping for Simey's `.card__glare2`)

It does **not** require `.card__glitter`.

## 2. Asset Requirements

**Assets actually referenced by `illustration-rare.css`:**

1. **`grain.webp`**
   - **File:** `grain.webp`
   - **Path:** `public/img/grain.webp`
   - **Purpose:** Used as a base texture within `.card__shine` to provide the tactile paper/print effect underlying the holographic shine.
   - **Existence Verified:** Yes (in source repository).

No other external image assets are referenced (no `illusion.png`, no foils, no masks). It relies entirely on repeating linear gradients and clip-paths.

## 3. Variable Requirements

**Variables required by `illustration-rare.css`:**

**Already exists in Rarebound:**
- `--rb-shine-opacity` (maps to `--card-opacity`)
- `--rb-glare-opacity` (maps to `--card-opacity`)

**Requires Translation (Math/Mapping):**
- `--pointer-x`
- `--pointer-y`
- `--background-x`
- `--background-y`
- `--pointer-from-center`

**Requires Creation (New to Render Architecture):**
- `--space` (e.g., `5%`)
- `--angle` (e.g., `133deg`)
- `--imgsize` (e.g., `500px`)
- `--clip` (SVG polygon path for the card border)
- `--grain` (URL to `grain.webp`)
- `--sunpillar-clr-1` through `--sunpillar-clr-6` (Color palette for the sunburst effect, typically inherited from `base.css`)

## 4. HoloController Requirements

IR heavily depends on positional pointer variables.

- **`--pointer-x` / `--pointer-y`:** Used as coordinates for `radial-gradient` positions (e.g., `at var(--pointer-x) var(--pointer-y)`). In HoloController, we have `--rb-tilt-x` and `--rb-tilt-y` which represent percentage translations (usually centered at 0 or 50%). These can be mapped directly if scaled to `0%-100%`.
- **`--background-x` / `--background-y`:** Used to pan `background-position` on the repeating linear gradients to simulate parallax and shine movement. These can be mathematically derived from tilt percentages.
- **`--pointer-from-center`:** Used to calculate dynamic `opacity` (e.g., `calc( var(--card-opacity) * var(--pointer-from-center) )`) and brightness thresholds.

**Does HoloController must be extended?**
Yes. To support IR without degrading visual fidelity, `HoloController` needs to compute and assign a normalized `--rb-pointer-from-center` scalar (a value from 0 to 1 representing distance from the origin) and potentially `--rb-bg-x`/`--rb-bg-y` if the math is too complex to do purely in `calc()` on the CSS side.

## 5. Mobile Safety

**Assessment:**
Assuming Showcase only, one active card, and GPU guards enabled:
- **Masking:** IR uses `clip-path: var(--clip)`, which is exceptionally fast and mobile-safe compared to `mask-image` with luminance modes.
- **Blend Modes:** Uses `screen`, `hue`, `hard-light`, `soft-light`, and `overlay`. While multiple blend modes are stacked, they are applied to CSS gradients rather than high-res bitmap textures.
- **Repaint:** Continuous repaint of `background-position` and gradients on interaction.

**Verdict:**
IR is **Safe** for mobile integration in Showcase mode. The lack of heavy luminance image masking makes it substantially more performant than SIR. No immediate simplification of rules is strictly necessary, though performance monitoring on lower-end devices is recommended during implementation.

## 6. Implementation Readiness

**Verdict: READY with Minor Adapters**

Illustration Rare can be integrated using:
- Existing showcase DOM (by mapping `.card__glare2` to `.card__glare::after`)
- Existing render tiers

**Required Updates Before Implementation:**
1. **HoloController:** Extend to calculate and output `--rb-pointer-from-center` and mapped `0-100%` pointer coordinates.
2. **Assets:** Import `grain.webp` to the project's static asset directory.
3. **CSS:** Import the sunpillar base colors and IR-specific rules, translating Simey's variables to the new `--rb-*` namespace.

Further foundational architecture work (like creating whole new DOM nodes or physics rewrites) is **NOT** required for Illustration Rare.
