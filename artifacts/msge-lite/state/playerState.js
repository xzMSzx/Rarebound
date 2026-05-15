/**
 * state/playerState.js — Phase 10.1
 *
 * Real economy: spendBalance actually deducts (no DEV_MODE bypass) UNLESS
 * Developer Access has enabled Infinite Balance, in which case purchases
 * succeed without subtracting and the save is flagged Sandbox Mode
 * (reputation gains are paused elsewhere).
 *
 * Starter Collector Grant: $120 on a brand-new save.
 */

import { isInfiniteBalance } from '../data/devAccess.js';
import { isPlainObject, readJson, writeJson } from '../data/persistenceStore.js';
import * as profileStorage from '../data/profileStorage.js';

const STORAGE_KEY      = 'tcg_player_v2';
const STARTING_BALANCE = 120.00;

let playerState = {
  balance: STARTING_BALANCE,
  collection: {},   // legacy, kept for compatibility
};

let _wasFreshLaunch = false;

export function loadPlayerState() {
  try {
    if (profileStorage.getItem(STORAGE_KEY)) {
      playerState = {
        ...playerState,
        ...readJson(STORAGE_KEY, playerState, isPlainObject).value,
      };
    } else {
      _wasFreshLaunch = true;
      savePlayerState();   // persist the starter grant immediately
    }
  } catch { /* ignore */ }
}

/**
 * True only on the first call to loadPlayerState() of a brand-new save.
 * Used by main.js to surface the "Starter Collector Grant" toast once.
 */
export function wasFreshLaunch() { return _wasFreshLaunch; }

export function savePlayerState() {
  return writeJson(STORAGE_KEY, playerState);
}

export function getBalance() { return playerState.balance; }

export function spendBalance(amount) {
  if (isInfiniteBalance()) return true;            // sandbox bypass
  if (playerState.balance < amount) return false;
  playerState.balance = +(playerState.balance - amount).toFixed(2);
  savePlayerState();
  return true;
}

export function addBalance(amount) {
  playerState.balance = +(playerState.balance + amount).toFixed(2);
  savePlayerState();
}

/** Legacy: kept so main.js still works. */
export function addCard(card) {
  if (!playerState.collection[card.id]) {
    playerState.collection[card.id] = {
      count: 1, rarity: card.rarityType,
      setId: card.set ? card.set.id : undefined, name: card.name,
    };
  } else {
    playerState.collection[card.id].count++;
  }
  savePlayerState();
}

export function getCollection() { return playerState.collection; }

// Dev console helpers (legacy)
window.resetBalance = function () { playerState.balance = 9999; savePlayerState(); };
window.giveMoney    = function (n) { addBalance(n); };
