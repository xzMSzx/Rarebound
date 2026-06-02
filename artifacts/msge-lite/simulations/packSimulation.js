/**
 * simulations/packSimulation.js
 * Pack Opening Simulator — TCG booster pack simulation.
 *
 * Phase 5.0: Real Pokémon TCG pack structure (10 cards per pack):
 *   Slots 1-5  → common
 *   Slots 6-7  → uncommon
 *   Slot  8    → reverse holo  (common/uncommon/rare with isReverseHolo flag)
 *   Slot  9    → rare
 *   Slot  10   → hit slot      (doubleRare → hyperRare via probability table)
 *
 * Architecture:
 *   - Rules are pure functions; no DOM access allowed
 *   - Each rule receives state + engine and returns updated state
 *   - The pity system is enforced through state.pityCounter
 *
 * CRITICAL: The engine RNG system and pity system logic (applyPityRule)
 * are NOT modified. Only pack generation logic is updated.
 */

import { Engine } from '../engine/engine.js';
import { weightedRandom } from '../engine/rng.js';
import { getHitProbabilities } from '../data/setProbabilityTables.js';
import { secureRandom } from '../data/cryptoUtils.js';

// ─── Backward-compatibility rarity stat mapping ──────────────────────────────
//
// engine/state.js and engine.js Monte Carlo still use the four legacy stat keys
// (common, rare, epic, legendary).  New real rarities are aggregated into them
// so all existing reporting and graph code continues to work unchanged.
//
// Section 10 mapping:
//   common   → common
//   uncommon → rare   (treated as rare for stats)
//   rare     → rare
//   holoRare → epic
//   doubleRare           → epic
//   illustrationRare     → epic
//   ultraRare            → legendary
//   specialIllustrationRare → legendary
//   hyperRare            → legendary

const STATS_TIER = {
  common:                  'common',
  uncommon:                'rare',
  rare:                    'rare',
  holoRare:                'epic',
  doubleRare:              'epic',
  illustrationRare:        'epic',
  ultraRare:               'legendary',
  specialIllustrationRare: 'legendary',
  hyperRare:               'legendary',
};

// ─── Slot-to-pool contract (Phase 5.1.1) ──────────────────────────────────────
//
// Single source of truth for which pool each slot draws from. Every call site
// in this file MUST consult getSlotPool() rather than hard-coding rarities,
// so future slot changes can't drift across the codebase.
//
// Returned values are *pool category identifiers*, not raw rarity strings —
// 'reverse' and 'hit' resolve to a concrete rarity inside the generation loop.

/**
 * @param {number} slot  1..10
 * @returns {'common'|'uncommon'|'reverse'|'rare'|'hit'}
 */
function getSlotPool(slot) {
  if (slot <= 5)   return 'common';
  if (slot <= 7)   return 'uncommon';
  if (slot === 8)  return 'reverse';
  if (slot === 9)  return 'rare';
  if (slot === 10) return 'hit';
  throw new Error(`getSlotPool: invalid slot number ${slot}`);
}

// ─── Reverse holo slot options ────────────────────────────────────────────────
//
// Slot 8 in real Pokémon packs is a "reverse holo" — any non-hit card with
// holographic foil applied to the card's background instead of the artwork.
// Weighted to mirror the ratio of common:uncommon:rare in real boosters.

const REVERSE_HOLO_OPTIONS = [
  { value: 'common',   weight: 70 },
  { value: 'uncommon', weight: 25 },
  { value: 'rare',     weight: 5  },
];

// ─── Hit slot: cumulative probability roll ────────────────────────────────────

/**
 * Roll the hit slot rarity using cumulative probability from the active set table.
 * Phase 5.0: Restricted to doubleRare and above — holoRare no longer appears
 * in the hit slot (it lives only in the reverse-holo and rare slots when foiled).
 *
 * The cumulative-sum approach is critical — comparing roll against raw
 * probability values (e.g. `if (roll < table.hyperRare)` followed by
 * `if (roll < table.specIllust)`) double-counts the rarest tiers.
 *
 * Walks rarest → most-common so the smallest probability bands get checked
 * first. Falls back to 'doubleRare' on floating-point overshoot.
 *
 * @returns {string} rarity key
 */
function rollHitSlot() {
  const table = getHitProbabilities();
  const roll  = secureRandom();

  let cumulative = 0;

  cumulative += table.hyperRare ?? 0;
  if (roll < cumulative) return 'hyperRare';

  cumulative += table.specialIllustrationRare ?? 0;
  if (roll < cumulative) return 'specialIllustrationRare';

  cumulative += table.ultraRare ?? 0;
  if (roll < cumulative) return 'ultraRare';

  cumulative += table.illustrationRare ?? 0;
  if (roll < cumulative) return 'illustrationRare';

  return 'doubleRare';
}

// ─── Unique ID helper ─────────────────────────────────────────────────────────

let _cardIdCounter = 0;

function nextCardId() {
  return `card_${++_cardIdCounter}`;
}

// ─── Rules ────────────────────────────────────────────────────────────────────

/**
 * Rule 1 — Increment the pack counter and log the pack opening.
 * @param {Object} state
 * @param {Engine} engine
 * @returns {Object} updated state
 */
function openPackRule(state, engine) {
  const packsOpened = state.packsOpened + 1;
  engine.eventLog.push(`Pack #${packsOpened} opened`);
  return { ...state, packsOpened };
}

/**
 * Rule 2 — Generate 10 cards according to real Pokémon TCG slot rules.
 *
 *   Slots 1-4  → common
 *   Slots 5-7  → uncommon
 *   Slot  8    → reverse (rare or holoRare)
 *   Slot  9    → rare or holoRare
 *   Slot  10   → hit slot (set probability table); pity guarantees holoRare minimum
 *
 * rarityStats uses backward-compatible legacy keys (common/rare/epic/legendary)
 * so the graph, stats display, and Monte Carlo report continue to work.
 *
 * @param {Object} state
 * @param {Engine} engine
 * @returns {Object} updated state
 */
function generateCardRule(state, engine) {
  const packNumber = state.packsOpened;
  const newCards   = [];
  const rarityStats = { ...state.rarityStats };
  const pityActive  = state.pityCounter >= 10;

  const slotStats = {
    slot1:  { ...state.slotStats.slot1  },
    slot2:  { ...state.slotStats.slot2  },
    slot3:  { ...state.slotStats.slot3  },
    slot4:  { ...state.slotStats.slot4  },
    slot5:  { ...state.slotStats.slot5  },
    slot6:  { ...state.slotStats.slot6  },
    slot7:  { ...state.slotStats.slot7  },
    slot8:  { ...state.slotStats.slot8  },
    slot9:  { ...state.slotStats.slot9  },
    slot10: { ...state.slotStats.slot10 },
  };

  for (let slot = 1; slot <= 10; slot++) {
    const slotType = getSlotPool(slot);
    let rarity;
    let isReverseHolo = false;

    switch (slotType) {
      case 'common':
        rarity = 'common';
        break;

      case 'uncommon':
        rarity = 'uncommon';
        break;

      case 'reverse':
        // Reverse holo — base rarity from common/uncommon/rare (70/25/5).
        // Stat tier follows the base rarity per Phase 5.0 §8.
        rarity = weightedRandom(REVERSE_HOLO_OPTIONS);
        isReverseHolo = true;
        break;

      case 'rare':
        rarity = 'rare';
        break;

      case 'hit':
        // Hit slot — doubleRare+ via active set table.
        // Pity guarantee: override to holoRare when pity is active. Kept intact
        // per the Phase 5.0 critical rule even though hit slot no longer
        // naturally rolls holoRare.
        rarity = pityActive ? 'holoRare' : rollHitSlot();
        break;
    }

    // Build the card entity
    const card = {
      id:         nextCardId(),
      rarity,
      packNumber,
      isReverseHolo,
    };

    newCards.push(card);

    // Accumulate into backward-compatible legacy stat keys
    const statKey = STATS_TIER[rarity] ?? 'common';
    rarityStats[statKey]++;

    // Track epic/legendary hits by slot for analytics (legacy slot reporting)
    if (statKey === 'epic' || statKey === 'legendary') {
      slotStats['slot' + slot][statKey]++;
    }

    // Log each slot result
    engine.eventLog.push(`  Slot ${slot}: ${rarity}`);

    // Log notable pulls
    if (statKey === 'epic')      engine.eventLog.push('  ★ Holo/Double Rare pulled!');
    if (statKey === 'legendary') engine.eventLog.push('  ★★ ULTRA/HYPER RARE pulled!!');
  }

  // Store cards as entities in the engine
  for (const card of newCards) {
    engine.addEntity({ id: card.id, type: 'card', data: { rarity: card.rarity } });
  }

  return {
    ...state,
    cards: [...state.cards, ...newCards],
    rarityStats,
    slotStats,
  };
}

/**
 * High-tier "chase" rarities — the only pulls that reset the pity counter
 * under the Phase 5.1 redesign. Phase 5.0 made every pack guarantee a
 * doubleRare-or-higher in slot 10, which made the old epic/legendary-based
 * reset trigger every single pack. This restricts the reset to genuine
 * chase cards so pity remains meaningful long-term.
 */
const HIGH_TIER_RARITIES = new Set([
  'ultraRare',
  'specialIllustrationRare',
  'hyperRare',
]);

/**
 * Rule 3 — Apply the pity system (Phase 5.1 redesign).
 *
 * Reset on UR / SIR / HR pulls only. doubleRare and illustrationRare no
 * longer reset pity (they're now baseline guarantees from the hit slot).
 *
 * Reverse-holo cards (slot 8) carry base rarities common/uncommon/rare and
 * therefore can't satisfy HIGH_TIER_RARITIES — Section 5 compatibility holds
 * automatically without a special-case branch.
 *
 * The pityWasActive branch is preserved exactly as before to honour the
 * "do not modify the pity activation contract" rule from Phase 5.0.
 *
 * @param {Object} state
 * @param {Engine} engine
 * @returns {Object} updated state
 */
function applyPityRule(state, engine) {
  const packCards     = state.cards.slice(-10);
  const hasHighTier   = packCards.some((c) => HIGH_TIER_RARITIES.has(c.rarity));
  const pityWasActive = state.pityCounter >= 10;

  let pityCounter;

  if (pityWasActive) {
    engine.eventLog.push('  ⚠ PITY SYSTEM ACTIVATED — holoRare guaranteed');
    pityCounter = 0;
  } else if (hasHighTier) {
    pityCounter = 0;
  } else {
    pityCounter = state.pityCounter + 1;
  }

  // Phase 5.1 §4 — placeholder for future Hyper Rare pity guarantee at 40 packs.
  // Logs only; does NOT alter pack probabilities. The Phase 7 economy work
  // will hook in here to upgrade the slot-10 roll once the threshold is hit.
  if (pityCounter >= 40) {
    engine.eventLog.push('  ★ Hyper Rare pity threshold reached (40+ packs)');
  }

  return { ...state, pityCounter };
}

/**
 * Rule 4 — Log a brief summary of the current simulation state.
 * @param {Object} state
 * @param {Engine} engine
 * @returns {Object} state (unchanged)
 */
function updateStatisticsRule(state, engine) {
  engine.eventLog.push(
    `  → Pity counter: ${state.pityCounter} | ` +
    `Total cards: ${state.cards.length}`
  );
  return state;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and return a fully-configured Engine instance for pack simulation.
 * @returns {Engine}
 */
export function createPackSimulation() {
  const engine = new Engine();

  engine.addRule(openPackRule);
  engine.addRule(generateCardRule);
  engine.addRule(applyPityRule);
  engine.addRule(updateStatisticsRule);

  engine.initializeSimulation();

  return engine;
}
