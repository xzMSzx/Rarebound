/**
 * data/agsAvailability.js
 *
 * Shared raw-copy availability helpers. AGS slabs and active submissions lock
 * physical copies, while collection storage only keeps aggregate counts.
 */

import { lockedCopiesFor } from './agsSubmissionManager.js';

export function rawCopiesAvailable(setId, cardId, ownedCount) {
  const owned = Math.max(0, Number(ownedCount) || 0);
  const locked = Math.max(0, Number(lockedCopiesFor(setId, cardId)) || 0);
  return Math.max(0, owned - locked);
}

export function hasRawCopyAvailable(setId, cardId, ownedCount) {
  return rawCopiesAvailable(setId, cardId, ownedCount) > 0;
}
