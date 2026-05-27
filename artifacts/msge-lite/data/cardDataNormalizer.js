/**
 * data/cardDataNormalizer.js
 * Canonical ingestion pipeline for external card JSON.
 *
 * All set data must pass through this module before it reaches runtime or
 * persistent caches, so downstream systems inherit the same HD image model.
 */

const CARD_BACK_URL = 'https://images.pokemontcg.io/cardback.png';

/**
 * Normalize raw card data into Rarebound's internal card shape.
 *
 * @param {unknown} cards
 * @returns {Object[]}
 */
export function normalizeCardData(cards) {
  if (!Array.isArray(cards)) return [];

  return cards
    .filter((card) => card && typeof card === 'object')
    .map((card) => normalizeCard(card))
    .filter((card) => card.images?.hires || card.images?.display || card.images?.small);
}

function normalizeCard(card) {
  const sourceImages = card.images && typeof card.images === 'object' ? card.images : {};
  const hires = sourceImages.large || sourceImages.hires || sourceImages.display || sourceImages.small || CARD_BACK_URL;
  const display = sourceImages.display || hires;
  const thumb = sourceImages.thumb || display;

  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    number: card.number,
    set: card.set,
    hp: card.hp,
    types: Array.isArray(card.types) ? card.types : undefined,
    artist: card.artist,
    flavorText: card.flavorText,
    subtypes: Array.isArray(card.subtypes) ? card.subtypes : undefined,
    supertype: card.supertype,
    evolvesFrom: card.evolvesFrom,
    evolvesTo: Array.isArray(card.evolvesTo) ? card.evolvesTo : undefined,
    images: {
      ...sourceImages,
      small: hires,
      large: hires,
      thumb,
      display,
      hires,
    },
  };
}
