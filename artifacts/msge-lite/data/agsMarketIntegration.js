/**
 * data/agsMarketIntegration.js — v1.5.0
 *
 * Pure helpers that translate the raw market value of a card into its
 * graded equivalent, using the AGS grading engine's tier multipliers.
 *
 * Kept intentionally thin so it can be called from anywhere (binder UI,
 * registry, market screen) without coupling to either the market or
 * grading internals.
 */

import { multiplierForTier, tierLabel } from './agsGradingEngine.js';

/**
 * Compute the graded value for a slab given the underlying raw value.
 *
 * @param {number} rawValue       — current raw market value
 * @param {object} grade          — grade summary from `summarizeGrade()`
 * @returns {number}              — graded slab value (rounded to 2dp)
 */
export function gradedValueFromRaw(rawValue, grade) {
  if (!grade?.tier?.id) return rawValue;
  const seed = grade?.subgrades ? undefined : 0.5;
  // Multiplier baked into the grade summary already accounts for seed.
  const mult = grade.multiplier ?? multiplierForTier(grade.tier.id, seed);
  return Math.round(Math.max(0, Number(rawValue) || 0) * mult * 100) / 100;
}

/**
 * Compute "raw vs graded" delta for the market screen comparison view.
 * @returns {{ raw, graded, delta, multiplier, label }}
 */
export function rawVsGraded(rawValue, grade) {
  const graded = gradedValueFromRaw(rawValue, grade);
  return {
    raw:    Math.round(rawValue * 100) / 100,
    graded,
    delta:  Math.round((graded - rawValue) * 100) / 100,
    multiplier: grade?.multiplier ?? 1,
    label: grade?.tier ? tierLabel(grade.tier.id) : 'Raw',
  };
}

/**
 * v1.6.0 — Compact raw → graded breakdown for a single slab. Used by the
 * Registry tile, card-detail archive section, and slab viewer panel.
 * @returns {{raw:number, graded:number, delta:number, deltaPct:number}}
 */
export function gradedDeltaForSlab(slab, rawValue) {
  const raw    = Math.max(0, Number(rawValue) || 0);
  const graded = gradedValueFromRaw(raw, slab?.grade);
  const delta  = Math.round((graded - raw) * 100) / 100;
  const deltaPct = raw > 0 ? Math.round(((graded - raw) / raw) * 100) : 0;
  return {
    raw:    Math.round(raw * 100) / 100,
    graded: Math.round(graded * 100) / 100,
    delta,
    deltaPct,
  };
}

/**
 * Sum total archive value across a list of graded slabs given a raw-value
 * lookup function. Used in the AGS hero panel + Archive Registry header.
 *
 * @param {Array} slabs — getCompletedSlabs() output
 * @param {(setId:string, cardId:string, rarity:string) => number} rawLookup
 * @returns {number}
 */
export function totalArchiveValue(slabs, rawLookup) {
  let sum = 0;
  for (const slab of slabs) {
    const raw = rawLookup(slab.setId, slab.cardId, slab.grade?.tier ? '' : '') || 0;
    sum += gradedValueFromRaw(raw, slab.grade);
  }
  return Math.round(sum * 100) / 100;
}
