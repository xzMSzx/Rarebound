/**
 * data/setProbabilityTables.js
 * Set-specific hit slot probability tables for the Phase 4.3 rarity system.
 *
 * Each set defines the probability distribution for the hit slot (slot 10).
 * Probabilities must sum to 1.0.
 *
 * Only hit-eligible rarities appear here (holoRare and above).
 * Slot 1-7 (commons/uncommons) and slots 8-9 (reverse/rare) are handled
 * separately in packSimulation.js.
 */

export const setProbabilities = {

  swsh7: {
    holoRare:                0.60,
    doubleRare:              0.20,
    illustrationRare:        0.10,
    ultraRare:               0.06,
    specialIllustrationRare: 0.03,
    hyperRare:               0.01,
  },

  sv3pt5: {
    holoRare:                0.62,
    doubleRare:              0.18,
    illustrationRare:        0.10,
    ultraRare:               0.06,
    specialIllustrationRare: 0.03,
    hyperRare:               0.01,
  },

  sv04pt5: {
    holoRare:                0.55,
    doubleRare:              0.20,
    illustrationRare:        0.12,
    ultraRare:               0.07,
    specialIllustrationRare: 0.04,
    hyperRare:               0.02,
  },

  sv2: {
    holoRare:                0.60,
    doubleRare:              0.20,
    illustrationRare:        0.10,
    ultraRare:               0.06,
    specialIllustrationRare: 0.03,
    hyperRare:               0.01,
  },

  swsh11: {
    holoRare:                0.60,
    doubleRare:              0.20,
    illustrationRare:        0.10,
    ultraRare:               0.06,
    specialIllustrationRare: 0.03,
    hyperRare:               0.01,
  },

};

/**
 * Fallback probability table used when no set is selected.
 * Mirrors the evs table as a sensible default.
 */
export const DEFAULT_HIT_PROBABILITIES = {
  holoRare:                0.60,
  doubleRare:              0.20,
  illustrationRare:        0.10,
  ultraRare:               0.06,
  specialIllustrationRare: 0.03,
  hyperRare:               0.01,
};

/** @type {string|null} */
let _currentSetId = null;

/**
 * Record the currently selected set so hit slot generation uses its table.
 * Call this after loadSet() resolves successfully.
 *
 * @param {string} setId
 */
export function setCurrentSet(setId) {
  _currentSetId = setId;
}

/**
 * Return the hit slot probability table for the currently selected set,
 * falling back to DEFAULT_HIT_PROBABILITIES if the set has no entry.
 *
 * @returns {Object.<string, number>}
 */
export function getHitProbabilities() {
  return (_currentSetId && setProbabilities[_currentSetId])
    ? setProbabilities[_currentSetId]
    : DEFAULT_HIT_PROBABILITIES;
}
