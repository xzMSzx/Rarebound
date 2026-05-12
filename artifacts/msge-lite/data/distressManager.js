/**
 * data/distressManager.js — Phase 11 (v1.2.0)
 *
 * Financial distress detection and recovery tracking.
 *
 * A "distress event" begins when the player's balance drops below $8.
 * Recovery is recorded when the balance returns to $8 or more after
 * having been in distress. This powers:
 *
 *  - The "Recovery Mode" banner on the Vendor Hub (pure UI hint)
 *  - The "Recovered Collector" milestone (economy category)
 *
 * Design intent: distress recovery is a SURVIVAL tool, not a farm.
 * The banner only shows a gentle nudge towards duplicate selling —
 * no special rates, no bonus cash that could be exploited.
 */

import { getBalance }                           from '../state/playerState.js';
import { recordDistressEntry, recordDistressRecovery, wasEverDistressed } from './statsManager.js';

const KEY = 'tcg_distress_state';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { currently: false }; }
  catch { return { currently: false }; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

const THRESHOLD = 8;

/** True when the player's current balance is below the distress threshold. */
export function isInDistress() {
  return getBalance() < THRESHOLD;
}

/**
 * Call this after any balance change (sell, pack purchase, request reward, etc.)
 * so the distress/recovery state machine stays up to date.
 */
export function checkDistressTransition() {
  const bal      = getBalance();
  const state    = load();
  const inDistress = bal < THRESHOLD;

  if (inDistress && !state.currently) {
    // Entering distress
    state.currently = true;
    save(state);
    recordDistressEntry();
  } else if (!inDistress && state.currently) {
    // Recovering from distress
    state.currently = false;
    save(state);
    if (wasEverDistressed()) recordDistressRecovery();
  }
}

/** Returns friendly recovery suggestions for the distress banner. */
export function getRecoverySuggestions() {
  return [
    {
      id: 'sellDuplicates',
      label: 'Sell Duplicate Cards',
      hint: 'Any duplicate in your collection can be sold at any vendor — even at reduced commission.',
    },
    {
      id: 'fulfillRequest',
      label: 'Fulfill a Vendor Request',
      hint: 'Vendor requests pay cash for cards you already own. Check the Vendor Hub.',
    },
    {
      id: 'claimStipend',
      label: 'Claim Daily Stipend',
      hint: 'Your daily collector stipend may be ready to claim.',
    },
  ];
}
