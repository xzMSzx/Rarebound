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
  const normalizedRaw = (rawRarity || '').trim().toLowerCase();

  const mapKey = Object.keys(VISUAL_RARITY_MAP).find(
    (k) => k.toLowerCase() === normalizedRaw
  );
  const rarity = mapKey ? VISUAL_RARITY_MAP[mapKey] : undefined;

  if (!rarity && rawRarity && !warnedRarities.has(rawRarity)) {
    warnedRarities.add(rawRarity);
    console.warn('[cardVisualMapper] Unknown rarity, falling back to common:', rawRarity);
  }

  const profile = {
    era: SWSH_SETS.has(setName) ? 'swsh' : 'sv',
    rarity: rarity || 'common',
  };

  console.log(`[cardVisualMapper] Resolved profile for "${card?.name || 'Unknown'}" (Raw: "${rawRarity}") ->`, profile);

  return profile;
}

export function getCardVisualDataset(card) {
  const profile = card?.visualProfile ?? getCardVisualProfile(card);
  return `data-era="${profile.era}" data-rarity="${profile.rarity}"`;
}

export function applyCardVisualDataset(element, card) {
  if (!element) return;
  const profile = card?.visualProfile ?? getCardVisualProfile(card);
  element.dataset.era = profile.era;
  element.dataset.rarity = profile.rarity;
}
