/**
 * data/requestFulfillmentManager.js
 *
 * Single commit path for vendor request fulfillment. It wraps collection,
 * request, reward, and stat writes in a rollback snapshot.
 */

import { completeRequest } from './requestManager.js';
import { completeEmergencyRequest } from './emergencyRequestManager.js';
import { addFavor } from './vendorManager.js';
import { addReputation } from './reputationManager.js';
import { incrementRequestsCompleted, addLifetimeRevenue } from './statsManager.js';
import { addBalance, loadPlayerState } from '../state/playerState.js';
import { withLocalStorageRollback } from './localStorageTransaction.js';

const REQUEST_FULFILLMENT_KEYS = [
  'tcg_collection_v2',
  'tcg_vendor_requests',
  'tcg_emergency_requests',
  'tcg_player_v2',
  'tcg_favor',
  'tcg_reputation',
  'tcg_stats',
];

export function fulfillVendorRequest(requestId) {
  const isEmergency = typeof requestId === 'string' && requestId.startsWith('emerg_');

  try {
    return withLocalStorageRollback(REQUEST_FULFILLMENT_KEYS, () => {
      const result = isEmergency
        ? completeEmergencyRequest(requestId)
        : completeRequest(requestId);

      if (!result.ok) return result;

      addBalance(result.reward);
      addFavor(result.vendorId, result.favorReward);
      if (result.repReward) addReputation(result.repReward);
      incrementRequestsCompleted();
      addLifetimeRevenue(result.reward);

      return { ...result, isEmergency };
    });
  } catch (err) {
    console.error('[request-fulfillment] transaction failed', err);
    try { loadPlayerState(); } catch {}
    return { ok: false, reason: 'write-failed' };
  }
}
