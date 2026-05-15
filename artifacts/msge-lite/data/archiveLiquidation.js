/**
 * data/archiveLiquidation.js
 *
 * Implements the Phase 1 Slab Economy logic for liquidating graded slabs.
 * Calculates realistic payouts factoring in grade liquidity, collector
 * demand, market conditions, and archive commission fees.
 */

import { gradedValueFromRaw } from './agsMarketIntegration.js';
import { getMarketValue, getAllMarketValues } from './marketValue.js';

const COMMISSIONS = {
  standard: 0.12,
  priority: 0.10,
  prestige: 0.08,
};

function getLiquidityRange(tierId) {
  switch (tierId) {
    case 'AGS_10':
    case 'BLACK_LABEL':
      return { min: 1.10, max: 1.35 }; // rare premium outcomes
    case 'AGS_9_5':
      return { min: 1.00, max: 1.10 };
    case 'AGS_9':
      return { min: 0.90, max: 1.00 };
    case 'AGS_8_5':
    case 'AGS_8':
      return { min: 0.75, max: 0.85 }; // slightly lower
    case 'AGS_7_5':
    case 'AGS_7':
    case 'AGS_6':
    case 'AGS_5':
    case 'AGS_4':
    case 'AGS_3':
    case 'AGS_2':
    case 'AGS_1':
    default:
      return { min: 0.50, max: 0.70 }; // slightly lower payout efficiency
  }
}

// Simple deterministic hash for "randomness" so the quote doesn't bounce around on re-renders
function quoteHash(uid) {
  let h = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return (h / 0xffffffff);
}

/**
 * Calculates a liquidation quote for a graded slab.
 *
 * @param {object} slab - The graded slab to evaluate.
 * @param {number} [forcedRawValue] - Optional raw value override.
 * @returns {object} Detailed breakdown of the valuation.
 */
export function calculateSlabQuote(slab, forcedRawValue) {
  let rawValue = forcedRawValue;
  if (rawValue == null) {
    const allVals = getAllMarketValues();
    rawValue = allVals[slab.cardId] ?? getMarketValue(slab.cardId, slab.rarity || 'common');
  }

  const slabValue = gradedValueFromRaw(rawValue, slab.grade);
  const tierId = slab.grade?.tier?.id || 'AGS_6';
  
  const liquidityRange = getLiquidityRange(tierId);
  const hashVal = quoteHash(slab.uid || slab.serial || 'fallback');
  const liquidityModifier = liquidityRange.min + hashVal * (liquidityRange.max - liquidityRange.min);
  
  // Market condition (baseline ~1.0, slight variance based on day)
  const timeHash = quoteHash((new Date().toISOString().slice(0, 10)) + (slab.uid || ''));
  const marketCondition = 0.98 + (timeHash * 0.04); // 0.98 to 1.02

  const demandModifier = 1.0;

  const commissionRate = COMMISSIONS[slab.tier] ?? COMMISSIONS.standard;

  let estimatedPayout = slabValue * liquidityModifier * demandModifier * marketCondition;
  
  let prestigeBonus = 0;
  if (slab.prestigeSlab) {
    prestigeBonus = estimatedPayout * 0.10; // Increased collector premium for prestige
  }

  let isPrivateCollector = false;
  if ((tierId === 'AGS_10' || tierId === 'BLACK_LABEL') && hashVal > 0.8) {
    isPrivateCollector = true;
    estimatedPayout *= 1.2; // private collector bonus
  }

  const commission = estimatedPayout * commissionRate;
  
  const finalTransfer = estimatedPayout - commission + prestigeBonus;

  return {
    rawValue,
    slabValue,
    liquidityModifier,
    marketCondition,
    demandModifier,
    estimatedPayout,
    commissionRate,
    commission,
    prestigeBonus,
    isPrivateCollector,
    finalTransfer: Math.max(0, finalTransfer)
  };
}
