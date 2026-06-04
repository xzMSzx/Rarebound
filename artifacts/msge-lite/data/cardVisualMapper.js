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

const LEGACY_RARITY_ALIASES = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  'rare holo': 'holo',
  holorare: 'holo',
  holo: 'holo',
  'double rare': 'double-rare',
  doublerare: 'double-rare',
  'illustration rare': 'ir',
  illustrationrare: 'ir',
  ir: 'ir',
  'ultra rare': 'ultra-rare',
  ultrarare: 'ultra-rare',
  'special illustration rare': 'sir',
  specialillustrationrare: 'sir',
  sir: 'sir',
  'hyper rare': 'hyper',
  hyperrare: 'hyper',
  hyper: 'hyper',
};

function getRawRarity(card) {
  return card?.rarityRaw || card?.apiRarity || card?.rarityType || card?.rarityName || card?.rarity || '';
}

export function normalizeRarityKey(rawRarity) {
  const normalizedRaw = String(rawRarity || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalizedRaw) return undefined;
  if (normalizedRaw in LEGACY_RARITY_ALIASES) return LEGACY_RARITY_ALIASES[normalizedRaw];
  const mapKey = Object.keys(VISUAL_RARITY_MAP).find(
    (k) => k.toLowerCase() === normalizedRaw
  );
  return mapKey ? VISUAL_RARITY_MAP[mapKey] : undefined;
}

export function getCardVisualProfile(card) {
  const setName = getSetName(card);
  const rawRarity = getRawRarity(card);
  let rarity = normalizeRarityKey(rawRarity);

  if (!rarity && rawRarity && !warnedRarities.has(rawRarity)) {
    warnedRarities.add(rawRarity);
    console.warn('[cardVisualMapper] Unknown rarity, falling back to common:', rawRarity);
  }

  const era = SWSH_SETS.has(setName) ? 'swsh' : 'sv';

  if (era === 'sv' && String(rawRarity).trim().toLowerCase() === 'rare') {
    rarity = 'holo';
  }

  const profile = {
    era,
    rarity: rarity || 'common',
  };

  console.log(`[cardVisualMapper] Resolved profile for "${card?.name || 'Unknown'}" (Raw: "${rawRarity}") ->`, profile);

  return profile;
}

export function getCardVisualDataset(card) {
  const profile = card?.visualProfile ?? getCardVisualProfile(card);
  const rarity = normalizeRarityKey(profile.rarity) || 'common';
  return `data-era="${profile.era}" data-rarity="${rarity}"`;
}

export function applyCardVisualDataset(element, card) {
  if (!element) return;
  const profile = card?.visualProfile ?? getCardVisualProfile(card);
  element.dataset.era = profile.era;
  element.dataset.rarity = normalizeRarityKey(profile.rarity) || 'common';
}
