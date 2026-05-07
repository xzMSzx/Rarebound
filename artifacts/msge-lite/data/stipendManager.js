/**
 * data/stipendManager.js — Phase 9.9
 *
 * Daily collector stipend. Free $10–$40+ once every 24 hours, scaled by
 * the player's collector reputation rank.
 *
 * Storage:  tcg_stipend → { lastClaimedTs }
 */

import { addBalance } from '../state/playerState.js';
import { getRank }    from './reputationManager.js';

const STORAGE_KEY = 'tcg_stipend';
const CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000;

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

const RANK_BONUS = {
  'Rookie Collector':      0,
  'Experienced Collector': 6,
  'Archivist':             18,
  'Master Collector':      30,
};

/** Total stipend amount (USD) the player would receive right now. */
export function getStipendAmount() {
  const rank  = getRank();
  const bonus = RANK_BONUS[rank.name] ?? 0;
  return 10 + bonus;
}

export function timeUntilNextClaimMs() {
  const s = load();
  if (!s.lastClaimedTs) return 0;
  return Math.max(0, CLAIM_INTERVAL_MS - (Date.now() - s.lastClaimedTs));
}

export function canClaim() { return timeUntilNextClaimMs() === 0; }

/** Compact label like "ready" or "23h 11m". */
export function getCountdownLabel() {
  const ms = timeUntilNextClaimMs();
  if (ms === 0) return 'Ready';
  const totalM = Math.ceil(ms / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Credits the stipend if eligible. Returns amount (0 if not yet claimable). */
export function claimStipend() {
  if (!canClaim()) return 0;
  const amt = getStipendAmount();
  addBalance(amt);
  save({ lastClaimedTs: Date.now() });
  return amt;
}
