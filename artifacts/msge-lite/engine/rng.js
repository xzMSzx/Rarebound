/**
 * engine/rng.js
 * Dedicated RNG module with seeded, deterministic randomness.
 *
 * Uses a Linear Congruential Generator (LCG) so every simulation
 * can be reproduced by restoring the same seed value.
 */

// Internal seed state — mutated on every random call
let _seed = 12345;

/**
 * Set the current seed value.
 * @param {number} s - Integer seed
 */
export function setSeed(s) {
  _seed = s >>> 0; // treat as unsigned 32-bit integer
}

/**
 * Read the current seed value (useful for save / replay).
 * @returns {number}
 */
export function getSeed() {
  return _seed;
}

/**
 * Advance the LCG and return a float in [0, 1).
 * Each call increments the seed so runs are deterministic.
 * @returns {number}
 */
function nextFloat() {
  // LCG constants from Numerical Recipes
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return (_seed >>> 0) / 0x100000000;
}

/**
 * Pick one value from a weighted options list.
 *
 * @param {Array<{value: string, weight: number}>} options
 * @returns {string} The selected value
 *
 * @example
 * weightedRandom([
 *   { value: 'common',    weight: 70 },
 *   { value: 'rare',      weight: 25 },
 *   { value: 'epic',      weight:  4 },
 *   { value: 'legendary', weight:  1 },
 * ]);
 */
export function weightedRandom(options) {
  if (!options || options.length === 0) {
    throw new Error('weightedRandom: options array must not be empty');
  }

  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let roll = nextFloat() * totalWeight;

  for (const option of options) {
    roll -= option.weight;
    if (roll < 0) {
      return option.value;
    }
  }

  // Fallback — floating-point edge case; return last option
  return options[options.length - 1].value;
}
