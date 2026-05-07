/**
 * engine/state.js
 * Factory for the initial simulation state.
 *
 * The state object is treated as immutable inside rules —
 * rules receive a copy and return a new object.
 *
 * Phase 4.3: slotStats expanded to slots 1-10 to match 10-card pack structure.
 * rarityStats retains the four legacy keys (common/rare/epic/legendary) so the
 * graph, stats display, and Monte Carlo report continue to work unchanged.
 */

/**
 * Create a fresh simulation state object.
 * @returns {SimulationState}
 *
 * @typedef {Object} SimulationState
 * @property {number} packsOpened      - Total packs opened so far
 * @property {Card[]} cards            - All generated card entities
 * @property {number} pityCounter      - Consecutive packs without a holo-or-better hit
 * @property {Object} rarityStats      - Count of each legacy rarity tier pulled
 * @property {Object} slotStats        - Epic/Legendary hits tracked per pack slot (slots 1-10)
 */
export function createInitialState() {
  return {
    packsOpened: 0,
    cards: [],
    pityCounter: 0,
    rarityStats: {
      common:    0,
      rare:      0,
      epic:      0,
      legendary: 0,
    },
    slotStats: {
      slot1:  { epic: 0, legendary: 0 },
      slot2:  { epic: 0, legendary: 0 },
      slot3:  { epic: 0, legendary: 0 },
      slot4:  { epic: 0, legendary: 0 },
      slot5:  { epic: 0, legendary: 0 },
      slot6:  { epic: 0, legendary: 0 },
      slot7:  { epic: 0, legendary: 0 },
      slot8:  { epic: 0, legendary: 0 },
      slot9:  { epic: 0, legendary: 0 },
      slot10: { epic: 0, legendary: 0 },
    },
  };
}
