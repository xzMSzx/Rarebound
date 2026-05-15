import { bulkAppendHistory } from './marketHistory.js';
import { secureRandom } from './cryptoUtils.js';
import * as profileStorage from './profileStorage.js';

/**
 * data/marketValue.js — Phase 8 + Phase 9 drift + Phase 10 Hydration
 *
 * Procedural value engine with live API market price hydration.
 *
 * Storage:
 *   tcg_market_values  → { [cardId]: number }
 *   tcg_market_meta    → { [cardId]: { tier, lastDrift, updatedAt } }
 */

const VALUE_KEY = 'tcg_market_values';
const META_KEY  = 'tcg_market_meta';

const VALUE_RANGES = {
  common:                  [0.05,   0.40],
  uncommon:                [0.10,   0.75],
  rare:                    [0.50,   4.00],
  holoRare:                [1.00,   8.00],
  doubleRare:              [5.00,  20.00],
  illustrationRare:        [15.00, 60.00],
  ultraRare:               [20.00, 80.00],
  specialIllustrationRare: [80.00, 300.00],
  hyperRare:               [120.00, 500.00],
};

const VOLATILITY = {
  common: 0.01, uncommon: 0.015, rare: 0.03, holoRare: 0.03,
  doubleRare: 0.05, illustrationRare: 0.07, ultraRare: 0.07,
  specialIllustrationRare: 0.10, hyperRare: 0.10,
};

const CACHE_TTL_MS = {
  common: 24 * 60 * 60 * 1000,
  uncommon: 24 * 60 * 60 * 1000,
  rare: 12 * 60 * 60 * 1000,
  holoRare: 12 * 60 * 60 * 1000,
  doubleRare: 12 * 60 * 60 * 1000,
  illustrationRare: 6 * 60 * 60 * 1000,
  ultraRare: 6 * 60 * 60 * 1000,
  specialIllustrationRare: 6 * 60 * 60 * 1000,
  hyperRare: 6 * 60 * 60 * 1000,
};

const _fetchQueue = [];
const _fetchingIds = new Set();
let _isProcessingQueue = false;
const MAX_CONCURRENCY = 3;

function hashFraction(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h / 0xffffffff;
}

function loadValues() { try { return JSON.parse(profileStorage.getItem(VALUE_KEY)) || {}; } catch { return {}; } }
function saveValues(v) { profileStorage.setItem(VALUE_KEY, JSON.stringify(v)); }
function loadMeta()   { try { return JSON.parse(profileStorage.getItem(META_KEY))  || {}; } catch { return {}; } }
function saveMeta(m)  { profileStorage.setItem(META_KEY,  JSON.stringify(m)); }

function extractPrice(apiCard) {
  if (!apiCard || !apiCard.tcgplayer || !apiCard.tcgplayer.prices) return null;
  const p = apiCard.tcgplayer.prices;
  const types = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', 'unlimitedHolofoil'];
  for (const t of types) {
    if (p[t] && p[t].market) return p[t].market;
  }
  for (const t of types) {
    if (p[t] && p[t].mid) return p[t].mid;
  }
  return null;
}

async function processFetchQueue() {
  if (_isProcessingQueue) return;
  _isProcessingQueue = true;

  while (_fetchQueue.length > 0) {
    const batch = _fetchQueue.splice(0, MAX_CONCURRENCY);
    
    await Promise.all(batch.map(async ({ cardId, rarityTier, retries }) => {
      try {
        const url = `https://api.pokemontcg.io/v2/cards/${cardId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const json = await response.json();
        const price = extractPrice(json.data);
        
        const meta = loadMeta();
        if (price != null) {
          meta[cardId] = { ...(meta[cardId] || {}), externalReferenceValue: +parseFloat(price).toFixed(2) };
          console.log(`[MarketValue] fetch success - id: ${cardId}, externalReferenceValue: ${meta[cardId].externalReferenceValue}`);
        } else {
          console.log(`[MarketValue] fetch success but no price - id: ${cardId}`);
        }
        
        meta[cardId] = { ...(meta[cardId] || {}), tier: rarityTier, updatedAt: Date.now() };
        saveMeta(meta);
        _fetchingIds.delete(cardId);
      } catch (err) {
        console.warn(`[MarketValue] API fallback/retry - id: ${cardId}, err: ${err.message}`);
        if (retries < 2) {
           _fetchQueue.push({ cardId, rarityTier, retries: retries + 1 });
        } else {
           const meta = loadMeta();
           meta[cardId] = { ...(meta[cardId] || {}), tier: rarityTier, updatedAt: Date.now() };
           saveMeta(meta);
           _fetchingIds.delete(cardId);
        }
      }
    }));
    
    // Debounce
    await new Promise(r => setTimeout(r, 1000));
  }

  _isProcessingQueue = false;
}

function queueFetch(cardId, rarityTier) {
  if (_fetchingIds.has(cardId)) return;
  _fetchingIds.add(cardId);
  _fetchQueue.push({ cardId, rarityTier, retries: 0 });
  console.log(`[MarketValue] refresh queued - id: ${cardId}, queue size: ${_fetchQueue.length}`);
  processFetchQueue();
}

/** Persisted market value for a card. Instantly resolves from cache or procedural fallback, then queues hydration. */
export function getMarketValue(cardId, rarityTier) {
  if (!cardId) return 0;
  const values = loadValues();
  const meta = loadMeta();
  const curMeta = meta[cardId] || {};
  
  const now = Date.now();
  const ttl = CACHE_TTL_MS[rarityTier] || CACHE_TTL_MS.common;
  const isStale = !curMeta.updatedAt || (now - curMeta.updatedAt > ttl);

  if (isStale) {
    queueFetch(cardId, rarityTier);
  }

  const [min, max] = VALUE_RANGES[rarityTier] ?? VALUE_RANGES.common;
  let finalVal = values[cardId];

  // Migration / Recalculation: restore procedural authority if missing or out of bounds.
  if (finalVal == null || !curMeta.proceduralAuthority) {
    const v = min + hashFraction(cardId) * (max - min);
    finalVal = +v.toFixed(2);
    
    values[cardId] = finalVal;
    saveValues(values);
    
    meta[cardId] = { ...curMeta, tier: rarityTier, proceduralAuthority: true };
    if (!meta[cardId].lastDrift) meta[cardId].lastDrift = now;
    saveMeta(meta);
    
    console.log(`[MarketValue] procedural recalculation - id: ${cardId}, tier: ${rarityTier}, val: ${finalVal}`);
  } else if (finalVal < min || finalVal > max) {
    // Failsafe clamp to ensure leftover API prices are normalized
    finalVal = Math.min(max, Math.max(min, finalVal));
    values[cardId] = finalVal;
    saveValues(values);
  }

  return finalVal;
}

/**
 * Enriches the per-card meta with type/set info so the trend system can
 * apply biases beyond rarity tiers. Safe to call multiple times — only writes
 * if new info is being added.
 */
export function enrichMarketMeta(cardId, { types, setId } = {}) {
  if (!cardId) return;
  const meta = loadMeta();
  const cur  = meta[cardId];
  if (!cur) return;
  let dirty = false;
  if (types && (!cur.types || cur.types.length === 0)) { cur.types = types; dirty = true; }
  if (setId && cur.setId !== setId) { cur.setId = setId; dirty = true; }
  if (dirty) { meta[cardId] = cur; saveMeta(meta); }
}

export function getAllMarketValues() {
  const values = loadValues();
  const meta = loadMeta();
  let changed = false;

  for (const cardId in values) {
    const m = meta[cardId] || {};
    // Auto-migrate any tainted values if we know their tier
    if (!m.proceduralAuthority && m.tier) {
      const [min, max] = VALUE_RANGES[m.tier] ?? VALUE_RANGES.common;
      const v = min + hashFraction(cardId) * (max - min);
      values[cardId] = +v.toFixed(2);
      
      m.proceduralAuthority = true;
      meta[cardId] = m;
      changed = true;
    }
  }

  if (changed) {
    saveValues(values);
    saveMeta(meta);
  }

  return values;
}

/**
 * Drifts every persisted card value by a random walk within its volatility
 * band, clamped to its rarity range. Applies trend multiplier if the card
 * matches the trend's affected types/rarities/sets.
 *
 * Called by economyManager.runRefresh().
 */
export function tickMarketValues(trend) {
  const values = loadValues();
  const meta   = loadMeta();
  const ids    = Object.keys(values);
  if (ids.length === 0) return;

  for (const id of ids) {
    const tier = meta[id]?.tier;
    if (!tier) continue;
    const range  = VALUE_RANGES[tier] ?? VALUE_RANGES.common;
    const vol    = VOLATILITY[tier]   ?? 0.02;
    let bias     = 1;
    const m      = meta[id];
    if (trend?.rarities?.includes(tier))                            bias = trend.multiplier;
    if (trend?.types   && m?.types?.some(t => trend.types.includes(t)))  bias = trend.multiplier;
    if (trend?.sets    && m?.setId && trend.sets.includes(m.setId))     bias = trend.multiplier;
    const drift  = (secureRandom() * 2 - 1) * vol;
    let next     = values[id] * (1 + drift) * bias;
    next         = Math.min(range[1], Math.max(range[0], next));
    values[id]   = +next.toFixed(2);
    meta[id].lastDrift = Date.now();
  }

  saveValues(values);
  saveMeta(meta);

  bulkAppendHistory(ids.map(id => ({ cardId: id, value: values[id] })));
}
