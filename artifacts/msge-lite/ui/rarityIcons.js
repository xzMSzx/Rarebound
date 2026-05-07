/**
 * ui/rarityIcons.js
 * Phase 4.4.5 — TCGP-style SVG rarity icons with explicit fill/stroke colors.
 *
 * CRITICAL FIX: All fills and strokes use explicit hex values, never
 * "currentColor". This prevents icons from becoming invisible inside containers
 * that use color:transparent for CSS gradient-text effects.
 *
 * Premium (ultraRare / specialIllustrationRare / hyperRare) polygons carry the
 * class "rarity-gold-poly" — CSS animates their fill independently of any
 * parent color property.
 *
 * Shape vocabulary:
 *   Diamond  — common / uncommon  (hollow outline, silver)
 *   Star     — rare tiers         (hollow outline, colored stroke)
 *   Gold star— premium tiers      (filled gold, animated shimmer)
 *   Sparkle  — specialIllustration (4-pointed burst, gold)
 *   Crown    — hyperRare          (crown shape, gold)
 */

// ─── SVG path data ────────────────────────────────────────────────────────────

const STAR_PTS = '12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26';
const DIAM_PTS = '12,2 22,12 12,22 2,12';

// ─── Shape primitives (explicit hex fills — no currentColor) ──────────────────

function diamond(stroke = '#b0b8c4') {
  return `<svg viewBox="0 0 24 24" class="rarity-icon rarity-diamond" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="${DIAM_PTS}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`;
}

function star(stroke = '#60a5fa') {
  return `<svg viewBox="0 0 24 24" class="rarity-icon rarity-star" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="${STAR_PTS}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`;
}

function goldStar() {
  return `<svg viewBox="0 0 24 24" class="rarity-icon rarity-star" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon class="rarity-gold-poly" points="${STAR_PTS}" fill="#fbbf24" stroke="#fde68a" stroke-width="0.5" stroke-linejoin="round"/>
  </svg>`;
}

function goldSparkle() {
  return `<svg viewBox="0 0 24 24" class="rarity-icon rarity-sparkle" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path class="rarity-gold-poly" d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" fill="#fbbf24" stroke="#fde68a" stroke-width="0.5"/>
  </svg>`;
}

function goldCrown() {
  return `<svg viewBox="0 0 24 24" class="rarity-icon rarity-crown" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path class="rarity-gold-poly" d="M3,19 L3,13 L7.5,17 L12,8 L16.5,17 L21,13 L21,19 Z" fill="#fbbf24" stroke="#fde68a" stroke-width="0.5" stroke-linejoin="round"/>
    <rect class="rarity-gold-poly" x="3" y="19" width="18" height="2.5" rx="1.2" fill="#fbbf24"/>
  </svg>`;
}

// ─── Multi-icon wrapper ───────────────────────────────────────────────────────

function multi(iconHtml, wrapClass) {
  return `<span class="rarity-multi ${wrapClass}">${iconHtml}</span>`;
}

// ─── Exported icon map ────────────────────────────────────────────────────────

export const RARITY_ICONS = {
  common:                  diamond(),
  uncommon:                multi(diamond() + diamond(), 'rarity-double'),
  rare:                    star('#60a5fa'),
  holoRare:                star('#38bdf8'),
  doubleRare:              multi(star('#60a5fa') + star('#60a5fa'), 'rarity-double'),
  illustrationRare:        multi(star('#a78bfa') + star('#a78bfa'), 'rarity-double'),
  ultraRare:               multi(goldStar() + goldStar() + goldStar(), 'rarity-triple'),
  specialIllustrationRare: multi(goldSparkle() + goldStar(), 'rarity-double'),
  hyperRare:               goldCrown(),
};

/** Safe fallback for unknown rarity keys. */
export const RARITY_ICON_FALLBACK = diamond();
