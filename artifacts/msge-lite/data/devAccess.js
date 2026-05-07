/**
 * data/devAccess.js — Phase 10.1
 *
 * Hidden Developer Access system. Unlocked via a passphrase from the
 * Settings screen. Provides Archive Utilities (testing tools) and an
 * Infinite Balance toggle that puts the save into Sandbox Mode —
 * reputation is paused while sandbox is active so casual testing
 * never contaminates progression balance.
 *
 * Storage:
 *   tcg_dev_access        → { unlocked: boolean, unlockedAt: number }
 *   tcg_infinite_balance  → boolean
 */

const ACCESS_KEY    = 'tcg_dev_access';
const INFINITE_KEY  = 'tcg_infinite_balance';

export const DEV_ACCESS_KEY = 'rarebound-dev';

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

export function isDevUnlocked() {
  return !!loadJSON(ACCESS_KEY, { unlocked: false }).unlocked;
}

export function tryUnlockDev(passphrase) {
  if (passphrase !== DEV_ACCESS_KEY) return false;
  saveJSON(ACCESS_KEY, { unlocked: true, unlockedAt: Date.now() });
  return true;
}

export function lockDev() {
  // Locking dev also forces infinite balance off so we can't leave
  // a hidden sandbox flag enabled.
  setInfiniteBalance(false);
  saveJSON(ACCESS_KEY, { unlocked: false });
}

export function isInfiniteBalance() {
  return loadJSON(INFINITE_KEY, false) === true;
}

export function setInfiniteBalance(on) {
  saveJSON(INFINITE_KEY, !!on);
}

/** Sandbox = infinite balance is on. Reputation gains pause in sandbox mode. */
export function isSandboxMode() {
  return isInfiniteBalance();
}
