/**
 * data/rarityMapper.js
 * Maps Pokémon TCG API rarity strings to the real Pokémon rarity categories.
 *
 * Phase 4.3: Replaced old simulator tiers (common/rare/epic/legendary)
 * with the authentic Pokémon TCG rarity structure.
 */

const RARITY_MAP = {
  // ── Common ───────────────────────────────────────────────────────────
  'Common':                          'common',

  // ── Uncommon ─────────────────────────────────────────────────────────
  'Uncommon':                        'uncommon',

  // ── Rare ─────────────────────────────────────────────────────────────
  'Rare':                            'rare',

  // ── Holo Rare ────────────────────────────────────────────────────────
  'Rare Holo':                       'holoRare',
  'Rare Prime':                      'holoRare',
  'Rare Break':                      'holoRare',

  // ── Double Rare ──────────────────────────────────────────────────────
  'Rare Holo EX':                    'doubleRare',
  'Rare Holo GX':                    'doubleRare',
  'Rare Holo V':                     'doubleRare',
  'Rare Holo VMAX':                  'doubleRare',
  'Rare Holo VSTAR':                 'doubleRare',
  'Double Rare':                     'doubleRare',
  'Rare ACE':                        'doubleRare',
  // Scarlet/Violet Ace Spec cards are a modern rare sub-tier that should
  // live inside the existing doubleRare category rather than create a
  // new rarity hierarchy branch.
  'Ace Spec Rare':                   'doubleRare',
  'ACE SPEC Rare':                   'doubleRare',

  // ── Illustration Rare ────────────────────────────────────────────────
  'Illustration Rare':               'illustrationRare',
  'Trainer Gallery Rare Holo':       'illustrationRare',
  'Rare Shiny':                      'illustrationRare',
  'Rare Shining':                    'illustrationRare',
  'Amazing Rare':                    'illustrationRare',

  // ── Ultra Rare ───────────────────────────────────────────────────────
  'Ultra Rare':                      'ultraRare',
  'Rare Ultra':                      'ultraRare',
  'LEGEND':                          'ultraRare',

  // ── Special Illustration Rare ────────────────────────────────────────
  'Special Illustration Rare':       'specialIllustrationRare',
  'Rare Shiny GX':                   'specialIllustrationRare',

  // ── Hyper Rare ───────────────────────────────────────────────────────
  'Hyper Rare':                      'hyperRare',
  'Secret Rare':                     'hyperRare',
  'Rare Secret':                     'hyperRare',
  'Rare Rainbow':                    'hyperRare',

  // ── Shiny variants (Phase 5.1.2 — Paldean Fates et al.) ──────────────
  // Paldean Fates' Shiny treatments dwarf the regular print run, so without
  // these entries 70%+ of the set falls through to the 'common' fallback
  // and poisons the commons pool with EX-tier artwork.
  'Shiny Rare':                      'illustrationRare',
  'Shiny Ultra Rare':                'specialIllustrationRare',
  'Shiny Rare V':                    'specialIllustrationRare',
  'Shiny Rare VMAX':                 'specialIllustrationRare',
  'Radiant Rare':                    'illustrationRare',
};

/**
 * Map a Pokémon TCG API rarity string to a real rarity category.
 *
 * @param {string|undefined} apiRarity
 * @returns {'common'|'uncommon'|'rare'|'holoRare'|'doubleRare'|'illustrationRare'|'ultraRare'|'specialIllustrationRare'|'hyperRare'}
 */
export function mapPokemonRarity(apiRarity) {
  if (!apiRarity) return 'common';

  // Exact match first
  if (apiRarity in RARITY_MAP) return RARITY_MAP[apiRarity];

  // Heuristic fallback: many modern set strings differ slightly (e.g. "Full Art",
  // "Rainbow Rare", "Rare Holo VSTAR"). Attempt to classify by tokens
  // before falling back to 'common'. This makes new set additions resilient
  // to API label variations without adding one-off mappings.
  const s = String(apiRarity).toLowerCase();

  if (s.includes('hyper') || s.includes('secret') || s.includes('rainbow')) return 'hyperRare';
  if (s.includes('special illustration') || s.includes('special-illustration') || s.includes('special illustration rare')) return 'specialIllustrationRare';
  if (s.includes('ultra') || s === 'legend' || s.includes('legend')) return 'ultraRare';
  if (s.includes('illustration') || s.includes('amazing') || s.includes('full art') || s.includes('full-art') || s.includes('alt art') || s.includes('alternate art')) return 'illustrationRare';
  if (s.includes('vmax') || s.includes('vstar') || s.includes('v ') || s.includes('ace spec') || s.includes('double rare') || s.includes('double')) return 'doubleRare';
  if (s.includes('holo') || s.includes('rare h') || s.includes('holo rare')) return 'holoRare';
  if (s.includes('rare')) return 'rare';

  // Unknown — log once for diagnostics and default to common
  console.warn('Unknown rarity string, falling back to common:', apiRarity);
  return 'common';
}
