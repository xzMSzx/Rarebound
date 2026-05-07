/**
 * ui/raritySymbols.js
 * Phase 4.4 — Pokémon-style rarity symbol system.
 *
 * Maps each of the nine real rarity categories to a clean Unicode symbol.
 * The system avoids excessive star stacking while maintaining a clear
 * visual progression from common through hyper rare.
 *
 * Symbols are purely visual — they do not affect simulation math.
 */

export const RARITY_SYMBOLS = {
  common:                  '◇',
  uncommon:                '◇◇',
  rare:                    '★',
  holoRare:                '★',
  doubleRare:              '★★',
  illustrationRare:        '★★',
  ultraRare:               '★★★',
  specialIllustrationRare: '✦★',
  hyperRare:               '✦✦',
};

/** Rarity tiers that receive premium gradient + shimmer treatment. */
export const PREMIUM_RARITIES = new Set([
  'ultraRare',
  'specialIllustrationRare',
  'hyperRare',
]);

/**
 * Return true if this rarity should display with the premium shimmer style.
 * @param {string} rarity
 * @returns {boolean}
 */
export function isPremiumRarity(rarity) {
  return PREMIUM_RARITIES.has(rarity);
}
