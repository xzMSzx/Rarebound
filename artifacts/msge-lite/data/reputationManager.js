/**
 * data/reputationManager.js — Phase 10
 *
 * Global Collector Reputation. Separate from per-vendor favor.
 * Increases from collection milestones, NEVER from selling, NEVER decreases.
 *
 * Phase 10 expanded the rank ladder from 4 → 7 tiers per spec.
 *
 * Storage key: tcg_reputation → { points: number }
 */

import { isSandboxMode } from './devAccess.js';

const STORAGE_KEY = 'tcg_reputation';

const RANKS = [
  { min: 0,     name: 'Rookie Collector',    description: 'Every great collection starts somewhere. Yours begins here.' },
  { min: 100,   name: 'Collector',           description: 'Your binder is taking shape. Vendors are starting to notice.' },
  { min: 400,   name: 'Advanced Collector',  description: 'A discerning eye. You know what\'s worth keeping.' },
  { min: 1000,  name: 'Elite Collector',     description: 'Sought after by vendors and rivals alike.' },
  { min: 2500,  name: 'Master Collector',    description: 'Few reach these heights. The rarest cards seek you out.' },
  { min: 5000,  name: 'Archive Curator',     description: 'Your collection is a living archive. Others study it.' },
  { min: 10000, name: 'Legendary Collector', description: 'The archive is complete. The legend endures.' },
];

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { points: 0 }; }
  catch { return { points: 0 }; }
}
function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

export function getReputation() { return load().points; }

/**
 * Award reputation. Negative amounts are clamped to zero — reputation
 * is a strictly non-decreasing collector signal per spec.
 */
export function addReputation(amount) {
  if (!amount || amount < 0) return load().points;
  // Sandbox mode (infinite balance) pauses reputation so casual testing
  // never contaminates the legitimate progression curve.
  if (isSandboxMode()) return load().points;
  const s = load();
  s.points = s.points + amount;
  save(s);
  return s.points;
}

/** Returns { name, current, nextMin, progressPct } for the current rank. */
export function getRank() {
  const points = getReputation();
  let current = RANKS[0];
  let next    = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].min) { current = RANKS[i]; next = RANKS[i + 1] || null; }
  }
  const progressPct = next
    ? Math.min(100, ((points - current.min) / (next.min - current.min)) * 100)
    : 100;
  return { name: current.name, description: current.description || '', current: points, nextMin: next?.min ?? null, progressPct };
}

export function getAllRanks() { return RANKS.slice(); }
