/**
 * data/vendorManager.js — Phase 9
 *
 * Four-vendor system with per-vendor favor and stock rotation.
 *
 * Storage keys:
 *   tcg_favor         → { [vendorId]: number }
 *   tcg_vendor_stocks → { [vendorId]: { packs: [setId], chase: [{cardId,setId,price}] } }
 */

import { PACK_STORE } from './packStore.js';

// ─── Vendor configuration ─────────────────────────────────────────────────────

export const VENDORS = {
  pokemart: {
    id: 'pokemart',
    name: 'PokéMart',
    tagline: 'Reliable modern stock refreshed daily.',
    theme: 'pokemart',
    priceMultiplier: 0.95,             // 5% off base
    setIds: ['sv4pt5', 'sv2', 'sv3pt5'],
    rotationCount: 3,
    sellCommissionBonus: 0,
  },
  retroVault: {
    id: 'retroVault',
    name: 'Retro Vault',
    tagline: 'Curated inventory sourced from private collector archives.',
    theme: 'retroVault',
    priceMultiplier: 1.20,             // 20% premium
    setIds: ['swsh7', 'swsh11'],
    rotationCount: 2,
    sellCommissionBonus: 0.02,         // pays 2% better commission
  },
  nightMarket: {
    id: 'nightMarket',
    name: 'Night Market',
    tagline: 'Unpredictable inventory with dangerous prices and rare finds.',
    theme: 'nightMarket',
    priceMultiplier: null,             // randomised per rotation
    setIds: ['swsh7','swsh11','sv4pt5','sv2','sv3pt5'],
    rotationCount: 2,
    sellCommissionBonus: -0.02,        // skims commission
  },
  broker: {
    id: 'broker',
    name: 'The Broker',
    tagline: 'A mysterious collector dealing in the rarest cards available.',
    theme: 'broker',
    priceMultiplier: null,
    setIds: [],                        // no packs — chase singles only
    rotationCount: 0,
    sellCommissionBonus: 0,
    timeGated: true,                   // Fri–Sun only
  },
  capsuleCorner: {
    id: 'capsuleCorner',
    name: 'Capsule Corner',
    tagline: 'Automated sealed inventory sourced from surplus distribution channels.',
    theme: 'capsuleCorner',
    priceMultiplier: null,
    setIds: [],
    rotationCount: 0,
    sellCommissionBonus: -0.01,
    foundationOnly: true,
  },
  museumExchange: {
    id: 'museumExchange',
    name: 'Museum Exchange',
    tagline: 'Curated archival requests from preservation institutions.',
    theme: 'museumExchange',
    priceMultiplier: null,
    setIds: [],
    rotationCount: 0,
    sellCommissionBonus: 0.03,
    foundationOnly: true,
  },
  estateAuctions: {
    id: 'estateAuctions',
    name: 'Estate Auctions',
    tagline: 'Private collector auctions featuring elite archival inventory.',
    theme: 'estateAuctions',
    priceMultiplier: null,
    setIds: [],
    rotationCount: 0,
    sellCommissionBonus: 0,
    foundationOnly: true,
  },
};

// ─── Favor ────────────────────────────────────────────────────────────────────

const FAVOR_KEY = 'tcg_favor';
const FAVOR_LEVEL_THRESHOLDS = [0, 50, 150, 350, 700];   // index = level-1

function loadFavor() {
  try { return JSON.parse(localStorage.getItem(FAVOR_KEY)) || {}; }
  catch { return {}; }
}
function saveFavor(f) { localStorage.setItem(FAVOR_KEY, JSON.stringify(f)); }

export function getFavor(vendorId)  { return loadFavor()[vendorId] || 0; }

export function addFavor(vendorId, amount) {
  const f = loadFavor();
  f[vendorId] = (f[vendorId] || 0) + amount;
  saveFavor(f);
  return f[vendorId];
}

export function getFavorLevel(vendorId) {
  const points = getFavor(vendorId);
  let lvl = 1;
  for (let i = 0; i < FAVOR_LEVEL_THRESHOLDS.length; i++) {
    if (points >= FAVOR_LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return lvl;
}

/** Returns { current, nextThreshold, progressPct } for UI bar. */
export function getFavorProgress(vendorId) {
  const points = getFavor(vendorId);
  const lvl    = getFavorLevel(vendorId);
  if (lvl >= 5) return { current: points, nextThreshold: null, progressPct: 100, level: 5 };
  const lo = FAVOR_LEVEL_THRESHOLDS[lvl - 1];
  const hi = FAVOR_LEVEL_THRESHOLDS[lvl];
  return {
    current: points,
    nextThreshold: hi,
    progressPct: Math.min(100, ((points - lo) / (hi - lo)) * 100),
    level: lvl,
  };
}

// ─── Time gate (Broker) ───────────────────────────────────────────────────────

/** True if the vendor is currently accepting business. Broker = Fri/Sat/Sun. */
export function isVendorOpen(vendorId) {
  if (vendorId !== 'broker') return true;
  if (localStorage.getItem('tcg_dev_force_broker') === 'true') return true;
  const day = new Date().getDay();   // 0 Sun … 5 Fri 6 Sat
  return day === 5 || day === 6 || day === 0;
}

/** Friendly label for when the Broker returns. */
export function getBrokerNextOpenLabel() {
  if (localStorage.getItem('tcg_dev_force_broker') === 'true') return null;
  const day = new Date().getDay();
  if (day === 5 || day === 6 || day === 0) return null;
  // 1 Mon → Fri = 4 days, etc.
  const daysUntilFri = (5 - day + 7) % 7;
  return daysUntilFri === 1 ? 'Returns tomorrow' : `Returns in ${daysUntilFri} days`;
}

// ─── Stock generation ─────────────────────────────────────────────────────────

const STOCK_KEY = 'tcg_vendor_stocks';

function loadStocks() {
  try { return JSON.parse(localStorage.getItem(STOCK_KEY)) || {}; }
  catch { return {}; }
}
function saveStocks(s) { localStorage.setItem(STOCK_KEY, JSON.stringify(s)); }

/** Returns { packs: [{setId, price, discount?}], chase: [{cardId, price}] }. */
export function getVendorStock(vendorId) {
  const stocks = loadStocks();
  return stocks[vendorId] || { packs: [], chase: [] };
}

/** Regenerates a single vendor's stock. */
export function regenerateVendorStock(vendorId) {
  const v      = VENDORS[vendorId];
  const stocks = loadStocks();

  if (vendorId === 'broker') {
    stocks[vendorId] = generateBrokerStock();
  } else if (vendorId === 'nightMarket') {
    stocks[vendorId] = generateNightMarketStock(v);
  } else {
    // Shuffle so PokéMart / Retro Vault get a different rotation slice
    // each refresh, preventing identical inventory feeling stale.
    const pool = [...v.setIds].sort(() => Math.random() - 0.5);
    stocks[vendorId] = {
      packs: pool.slice(0, v.rotationCount).map(setId => {
        const base = PACK_STORE[setId]?.price ?? 20;
        return { setId, price: +(base * v.priceMultiplier).toFixed(2) };
      }),
      chase: [],
    };
  }
  saveStocks(stocks);
}

export function regenerateAllVendorStocks() {
  Object.keys(VENDORS).forEach(regenerateVendorStock);
}

function generateNightMarketStock(v) {
  // Pick 2 random packs with random discount 10-35% off
  const pool   = [...v.setIds].sort(() => Math.random() - 0.5).slice(0, v.rotationCount);
  return {
    packs: pool.map(setId => {
      const base     = PACK_STORE[setId]?.price ?? 20;
      const discount = 0.10 + Math.random() * 0.25;
      return {
        setId,
        price: +(base * (1 - discount)).toFixed(2),
        discount: Math.round(discount * 100),
      };
    }),
    chase: [],
  };
}

function generateBrokerStock() {
  // Broker inventory is owned by chaseManager (weekly Friday rotation,
  // persistent prices). vendorManager just stores an empty placeholder so
  // its own refresh cycle never wipes the weekly picks.
  return { packs: [], chase: [] };
}

/** Effective pack price after favor discount. Level 1 = -1%, 2 = -2%, ... 5 = -5%. */
export function getEffectivePackPrice(vendorId, basePrice) {
  const lvl = getFavorLevel(vendorId);
  const discount = lvl * 0.01;
  return +(basePrice * (1 - discount)).toFixed(2);
}

/** Vendor-specific holo-bonus odds (Phase 9.5 favor lvl 2+). */
export function getHoloBonus(vendorId) {
  const lvl = getFavorLevel(vendorId);
  if (lvl >= 2) return 0.005 * (lvl - 1);   // tiny bonus
  return 0;
}
