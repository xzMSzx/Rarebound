/**
 * data/cardVisualMapper.js
 *
 * Single source of truth for visual metadata consumed by future showcase
 * rarity effects. Add future set/rarity mappings here, not in renderers.
 */

export const SWSH_SETS = new Set([
  'Evolving Skies',
  'Lost Origin',
]);

export const VISUAL_RARITY_MAP = {
  Common: 'common',
  Uncommon: 'uncommon',
  Rare: 'rare',
  'Rare Holo': 'holo',
  'Double Rare': 'double-rare',
  'Illustration Rare': 'ir',
  'Ultra Rare': 'ultra-rare',
  'Special Illustration Rare': 'sir',
  'Hyper Rare': 'hyper',
};

const warnedRarities = new Set();

function getSetName(card) {
  return card?.set?.name || card?.setName || '';
}

function getRawRarity(card) {
  return card?.rarityRaw || card?.apiRarity || card?.rarityName || card?.rarity || '';
}

export function getCardVisualProfile(card) {
  const setName = getSetName(card);
  const rawRarity = getRawRarity(card);
  const rarity = VISUAL_RARITY_MAP[rawRarity];

  if (!rarity && rawRarity && !warnedRarities.has(rawRarity)) {
    warnedRarities.add(rawRarity);
    console.warn('[cardVisualMapper] Unknown rarity, falling back to common:', rawRarity);
  }

  return {
    era: SWSH_SETS.has(setName) ? 'swsh' : 'sv',
    rarity: rarity || 'common',
  };
}

export function getCardVisualDataset(card) {
  const profile = getCardVisualProfile(card);
  return `data-era="${profile.era}" data-rarity="${profile.rarity}"`;
}

export function applyCardVisualDataset(element, card) {
  if (!element) return;
  const profile = getCardVisualProfile(card);
  element.dataset.era = profile.era;
  element.dataset.rarity = profile.rarity;
}
