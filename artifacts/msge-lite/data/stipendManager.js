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

// v1.2.1 — Stipend ranges per rank. The exact amount varies daily within
// the band (seeded by calendar day so it's consistent within a single day).
// Ranges feel earned: $10–15 at Rookie, $60–65 cap at Legendary.
const RANK_STIPEND_RANGE = {
  'Rookie Collector':      [10, 15],
  'Collector':             [20, 25],
  'Advanced Collector':    [30, 40],
  'Elite Collector':       [45, 50],
  'Master Collector':      [52, 58],
  'Archive Curator':       [58, 62],
  'Legendary Collector':   [60, 65],
};

/** Total stipend amount (USD) the player would receive right now. */
export function getStipendAmount() {
  const rank  = getRank();
  const range = RANK_STIPEND_RANGE[rank.name] ?? [10, 15];
  // Deterministic daily variation: same amount all day, changes tomorrow.
  const dayKey = Math.floor(Date.now() / 86_400_000);
  const seed   = ((dayKey * 9_301 + 49_297) % 233_280) / 233_280;
  return Math.round(range[0] + seed * (range[1] - range[0]));
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
