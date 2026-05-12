/**
 * data/prestigeManager.js — v1.4.0
 *
 * Collection Prestige — a museum-style quality score derived from what
 * the player owns and has accomplished. NOT money, reputation, or rank.
 *
 * Score is derived (no separate persisted total), with a small "bonus
 * points" bucket for events that aren't visible from raw collection
 * state (wishlist hits at pull time, prestige pulls, etc).
 *
 * Storage: tcg_prestige_bonus → { points: number, lastUpdated: number }
 *
 * Design intent: feels like cosmetic archive status, not RPG XP. The
 * UI should display a tier label ("Distinguished", "Elite Archive")
 * rather than a raw number.
 */

import { getCollection } from './collectionManager.js';
import { getCachedSetCards } from './cardPoolManager.js';
import { mapPokemonRarity } from './rarityMapper.js';
import { getClaimedMilestones } from './milestoneManager.js';

const BONUS_KEY = 'tcg_prestige_bonus';

// Per-rarity ownership weight. Commons contribute almost nothing.
const RARITY_WEIGHT = {
  common:                  0,
  uncommon:                0,
  rare:                    1,
  doubleRare:              4,
  ultraRare:               8,
  illustrationRare:       12,
  specialIllustrationRare:18,
  hyperRare:              25,
};

// Tier thresholds (chosen to feel earned, not grindy).
const TIERS = [
  { min:    0, name: 'Beginning Archive' },
  { min:  150, name: 'Modest Collection' },
  { min:  400, name: 'Notable Holdings' },
  { min:  900, name: 'Distinguished' },
  { min: 1800, name: 'Elite Archive' },
  { min: 3500, name: 'Curated Vault' },
  { min: 6000, name: 'Renowned Collector' },
  { min:10000, name: 'Legendary Archive' },
];

function loadBonus() {
  try { return JSON.parse(localStorage.getItem(BONUS_KEY)) || { points: 0, lastUpdated: 0 }; }
  catch { return { points: 0, lastUpdated: 0 }; }
}
function saveBonus(b) {
  try { localStorage.setItem(BONUS_KEY, JSON.stringify(b)); } catch {}
}

/** Pure computation — score from collection + completions + milestones + bonus. */
export function getPrestigeScore() {
  const collection = getCollection();
  let score = 0;
  let setCompletions = 0;

  for (const [setId, cards] of Object.entries(collection)) {
    const cached = getCachedSetCards(setId) || [];
    const byId   = Object.fromEntries(cached.map(c => [c.id, c]));
    const ownedCount = Object.keys(cards).length;

    for (const cardId of Object.keys(cards)) {
      const apiCard = byId[cardId];
      const tier    = apiCard ? mapPokemonRarity(apiCard.rarity) : 'common';
      score += RARITY_WEIGHT[tier] || 0;
    }

    if (cached.length > 0 && ownedCount === cached.length) {
      setCompletions++;
    }
  }

  // Set completion contribution — meaningful but capped feel
  score += setCompletions * 100;

  // Milestones contribute as cumulative recognition
  try { score += (getClaimedMilestones()?.length || 0) * 8; } catch {}

  // Discretionary bonus (wishlist hits, prestige pulls, etc)
  score += loadBonus().points;

  return Math.round(score);
}

/** Returns { name, min, nextMin (or null), progressPct } */
export function getPrestigeTier() {
  const score = getPrestigeScore();
  let cur = TIERS[0];
  let next = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (score >= TIERS[i].min) { cur = TIERS[i]; next = TIERS[i + 1] || null; }
  }
  const progressPct = next
    ? Math.max(0, Math.min(100, ((score - cur.min) / (next.min - cur.min)) * 100))
    : 100;
  return { score, name: cur.name, min: cur.min, nextMin: next ? next.min : null, progressPct };
}

/** Add discretionary prestige (e.g. wishlist hit = 12, prestige pull = 8). */
export function addPrestigeBonus(points, reason = '') {
  if (!Number.isFinite(points) || points <= 0) return;
  const b = loadBonus();
  const before = b.points;
  b.points += points;
  b.lastUpdated = Date.now();
  saveBonus(b);
  return { before, after: b.points, delta: points, reason };
}

export function getPrestigeBonusTotal() { return loadBonus().points; }

export function resetPrestigeBonus() {
  localStorage.removeItem(BONUS_KEY);
}
