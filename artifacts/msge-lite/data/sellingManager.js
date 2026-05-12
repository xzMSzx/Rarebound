/**
 * data/sellingManager.js — Phase 9
 *
 * Selling logic. Calculates payouts, applies vendor commission, writes
 * payout to player balance, awards favor, and decrements collection.
 *
 * First copy of every card auto-locks. Selling a locked card requires
 * an explicit unlock (handled in the UI).
 */

import { getMarketValue }  from './marketValue.js';
import { decrementCard, isLocked, unlockCard, getOwnedEntry } from './collectionManager.js';
import { hasRawCopyAvailable } from './agsAvailability.js';
import { addFavor, VENDORS } from './vendorManager.js';
import { addBalance }       from '../state/playerState.js';

// ─── Commission table per rarity tier ─────────────────────────────────────────

const COMMISSION = {
  common: 0.02, uncommon: 0.03, rare: 0.05, holoRare: 0.05,
  doubleRare: 0.08, illustrationRare: 0.12, ultraRare: 0.12,
  specialIllustrationRare: 0.15, hyperRare: 0.15,
};

/**
 * Computes the payout breakdown without committing the sale.
 * @returns {{ value, commissionPct, commissionAmt, payout, favorReward }}
 */
export function calculateSellPayout(cardId, rarityTier, vendorId) {
  const value         = getMarketValue(cardId, rarityTier);
  const baseComm      = COMMISSION[rarityTier] ?? 0.05;
  const vendorBonus   = VENDORS[vendorId]?.sellCommissionBonus ?? 0;
  const commissionPct = Math.max(0.01, baseComm + vendorBonus);
  const commissionAmt = +(value * commissionPct).toFixed(2);
  const payout        = +(value - commissionAmt).toFixed(2);
  const favorReward   = Math.max(1, Math.round(commissionAmt * 1.5));
  return { value, commissionPct, commissionAmt, payout, favorReward };
}

/** Returns true if the card cannot be sold without an unlock confirmation. */
export function isSellGated(setId, cardId, count) {
  // Selling reduces count by 1. Only the LAST copy is gated.
  return count === 1 && isLocked(setId, cardId);
}

/**
 * Commits a sale: decrements count, credits balance, awards favor.
 * If the card is the last copy AND still locked, throws unless the caller
 * passes `{ force: true }` — which is how the sell-modal signals the user
 * acknowledged the unlock warning.
 *
 * @returns {{ payout, favorReward, vendorId }}
 */
export function sellCard(setId, cardId, rarityTier, vendorId, opts = {}) {
  const entry = getOwnedEntry(setId, cardId);
  if (!entry) throw new Error('CARD_NOT_OWNED');
  if (!hasRawCopyAvailable(setId, cardId, entry.count)) {
    throw new Error('NO_RAW_COPY_AVAILABLE');
  }

  if (entry.count === 1 && isLocked(setId, cardId) && !opts.force) {
    throw new Error('LOCKED_LAST_COPY: caller must confirm unlock before selling.');
  }

  // Last-copy sales clear the lock so future re-acquisitions start fresh.
  if (isLocked(setId, cardId)) unlockCard(setId, cardId);

  const breakdown = calculateSellPayout(cardId, rarityTier, vendorId);
  decrementCard(setId, cardId);
  addBalance(breakdown.payout);
  addFavor(vendorId, breakdown.favorReward);
  return { ...breakdown, vendorId };
}
