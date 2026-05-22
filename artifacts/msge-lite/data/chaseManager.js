/**
 * data/chaseManager.js — Phase 9.6
 *
 * Owns two related "spotlight" systems:
 *
 *   1. Daily Chase Card — one rotating Pokémon highlighted every 24 h.
 *      Receives a temporary +10–25% market value boost. Purely economic /
 *      aspirational; does NOT alter pull rates.
 *
 *   2. Broker Weekly Inventory — exactly two chase singles selected each
 *      Friday and persisted for the entire weekend. Prices are derived from
 *      the card's market value × rarity multiplier × scarcity multiplier
 *      and clamped to a $350–$2200 range to feel "broker-tier".
 *
 * Storage:
 *   tcg_chase       → { cardId, setId, name, imageUrl, tier, boostPct, expiry }
 *   tcg_broker_inv  → { weekKey, picks: [{cardId,setId,tier,price,name,imageUrl}] }
 */

import { getMarketValue } from './marketValue.js';
import { getCachedSetCards } from './cardPoolManager.js';
import { mapPokemonRarity } from './rarityMapper.js';
import { getCollection } from './collectionManager.js';

const CHASE_KEY  = 'tcg_chase';
const BROKER_KEY = 'tcg_broker_inv';

const CHASE_DURATION_MS = 24 * 60 * 60 * 1000;

const ALL_SET_IDS    = ['swsh7','swsh11','sv4pt5','sv2','sv3pt5','sv6','sv7','sv8','sv8pt5','sv9'];
const CHASE_TIERS    = ['ultraRare','specialIllustrationRare','hyperRare','illustrationRare'];
const BROKER_TIERS   = ['hyperRare','specialIllustrationRare','ultraRare'];

// v1.2.0 — Broker pricing rebalanced. Target range: $250–$700 typical,
// $800–$1000 max. Old multipliers produced absurd $1600–$2500 prices
// that felt out of reach. New numbers keep the Broker prestigious but
// reachable by mid-game players.
const RARITY_MULT = {
  ultraRare:               1.8,
  illustrationRare:        1.8,
  specialIllustrationRare: 2.8,
  hyperRare:               2.5,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

/** Date string of the most recent Friday (or today if Fri/Sat/Sun). */
export function getCurrentBrokerWeekKey() {
  const d   = new Date();
  const day = d.getDay();                // 0=Sun … 5=Fri 6=Sat
  const daysSinceFri = (day - 5 + 7) % 7;
  d.setDate(d.getDate() - daysSinceFri);
  return 'FRI-' + d.toISOString().slice(0, 10);
}

/** Pick one random card matching a tier across cached sets, prefer not-owned. */
function pickCardByTier(tiers, { excludeIds = new Set(), preferUnowned = true } = {}) {
  const collection = getCollection();
  const candidates = [];

  for (const setId of ALL_SET_IDS) {
    const cached = getCachedSetCards(setId) || [];
    for (const c of cached) {
      const tier = mapPokemonRarity(c.rarity);
      if (!tiers.includes(tier)) continue;
      if (excludeIds.has(c.id))  continue;
      const ownedCount = collection[setId]?.[c.id]?.count ?? 0;
      candidates.push({ apiCard: c, setId, tier, ownedCount });
    }
  }
  if (candidates.length === 0) return null;

  // Prioritise: not owned > owned-once > heavily owned
  const pool = preferUnowned
    ? (candidates.filter(c => c.ownedCount === 0).length > 0
        ? candidates.filter(c => c.ownedCount === 0)
        : candidates)
    : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Daily Chase ─────────────────────────────────────────────────────────────

/** Returns the active chase or null if none / expired. */
export function getDailyChase() {
  const c = loadJSON(CHASE_KEY);
  if (!c || !c.expiry || Date.now() > c.expiry) return null;
  return c;
}

/**
 * Returns the multiplier currently applied to a card's market value
 * because of chase status. 1.0 if not the chase card.
 */
export function getChaseBoost(cardId) {
  const c = getDailyChase();
  if (!c || c.cardId !== cardId) return 1;
  return 1 + (c.boostPct / 100);
}

/** True if the given cardId is the active chase card. */
export function isChaseCard(cardId) {
  const c = getDailyChase();
  return !!(c && c.cardId === cardId);
}

/**
 * Generates a new daily chase if the current one is missing/expired.
 * Returns the (possibly new) chase, or null if no candidates yet (sets still
 * loading). Safe to call repeatedly.
 */
export function ensureDailyChase() {
  const existing = getDailyChase();
  if (existing) return existing;

  const pick = pickCardByTier(CHASE_TIERS, { preferUnowned: false });
  if (!pick) return null;

  const boostPct = 10 + Math.floor(Math.random() * 16);   // 10–25%
  const chase = {
    cardId:   pick.apiCard.id,
    setId:    pick.setId,
    name:     pick.apiCard.name,
    imageUrl: pick.apiCard.images.small || pick.apiCard.images.large,
    tier:     pick.tier,
    boostPct,
    expiry:   Date.now() + CHASE_DURATION_MS,
  };
  saveJSON(CHASE_KEY, chase);
  return chase;
}

// ─── Broker weekly inventory ─────────────────────────────────────────────────

/**
 * Returns the persistent Broker inventory for the current Friday-Sunday week.
 * Generates it on first call of the weekend (when sets are cached).
 *
 *   [{ cardId, setId, tier, price, name, imageUrl }]
 *
 * Returns [] if no candidate cards are loaded yet.
 */
export function getBrokerInventory() {
  const wk      = getCurrentBrokerWeekKey();
  const stored  = loadJSON(BROKER_KEY);
  if (stored && stored.weekKey === wk && Array.isArray(stored.picks) && stored.picks.length > 0) {
    return stored.picks;
  }

  // Need fresh inventory — pick 2 chase singles.
  const picks   = [];
  const exclude = new Set();
  for (let i = 0; i < 2; i++) {
    const p = pickCardByTier(BROKER_TIERS, { excludeIds: exclude, preferUnowned: true });
    if (!p) break;
    exclude.add(p.apiCard.id);
    picks.push(buildBrokerPick(p));
  }
  if (picks.length === 0) return [];

  saveJSON(BROKER_KEY, { weekKey: wk, picks });
  return picks;
}

function buildBrokerPick({ apiCard, setId, tier }) {
  const baseValue  = getMarketValue(apiCard.id, tier);
  const rarityMult = RARITY_MULT[tier] ?? 3;
  // Scarcity multiplier: cards with fewer alt-arts in their set feel rarer.
  // We approximate via a small jitter + a flat 1.0–1.6 band.
  const scarcity   = 1.0 + Math.random() * 0.3;    // 1.0–1.30 (tighter band)
  let price        = baseValue * rarityMult * scarcity;
  price            = Math.max(250, Math.min(1000, price));  // $250–$1000 range
  return {
    cardId:   apiCard.id,
    setId,
    tier,
    price:    +price.toFixed(2),
    name:     apiCard.name,
    imageUrl: apiCard.images.small || apiCard.images.large,
  };
}

/** Removes a single sold pick from current inventory (so it can't be bought twice). */
export function removeBrokerPick(cardId) {
  const stored = loadJSON(BROKER_KEY);
  if (!stored?.picks) return;
  stored.picks = stored.picks.filter(p => p.cardId !== cardId);
  saveJSON(BROKER_KEY, stored);
}
