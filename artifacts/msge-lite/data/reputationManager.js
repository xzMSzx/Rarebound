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
  { min: 0,     name: 'Rookie Collector' },
  { min: 100,   name: 'Collector' },
  { min: 400,   name: 'Advanced Collector' },
  { min: 1000,  name: 'Elite Collector' },
  { min: 2500,  name: 'Master Collector' },
  { min: 5000,  name: 'Archive Curator' },
  { min: 10000, name: 'Legendary Collector' },
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
  return { name: current.name, current: points, nextMin: next?.min ?? null, progressPct };
}

export function getAllRanks() { return RANKS.slice(); }
