import { getActiveGlobalState, getVendorOperationalState } from './vendorStateManager.js';

export const CAPSULE_ARCHETYPES = [
  {
    id: 'archive',
    name: 'Archive Capsule',
    tag: 'Measured',
    price: 32,
    bias: 'Contemporary collector demand stable.',
    signal: 'Illustration pressure elevated.',
    rewards: ['Modern sealed pull table', 'Stable outcomes', 'Premium modern atmosphere'],
    sets: ['sv6', 'sv8pt5'],
    rarityShaping: { rare: { doubleRare: 0.1, illustrationRare: 0.05, rare: 0.85 } }
  },
  {
    id: 'distortion',
    name: 'Distortion Capsule',
    tag: 'Unstable',
    price: 24,
    bias: 'Distribution irregularities detected.',
    signal: 'Volatility index above baseline.',
    rewards: ['Wide rarity variance', 'Strong jackpot potential', 'Occasional failures'],
    sets: ['sv8', 'sv7'],
    rarityShaping: { rare: { holoRare: 0.2, secretRare: 0.05, uncommon: 0.25, rare: 0.5 } }
  },
  {
    id: 'prism',
    name: 'Prism Capsule',
    tag: 'Scarce',
    price: 50,
    bias: 'Luxury archival sourcing active.',
    signal: 'Collector-grade capsule integrity verified.',
    rewards: ['Lower quantity', 'Premium card weighting', 'Elite pulls'],
    sets: ['sv8pt5'],
    rarityShaping: { rare: { doubleRare: 0.15, ultraRare: 0.1, secretRare: 0.05, rare: 0.7 } }
  }
];

export function getDailyCapsules() {
  const day = Math.floor(Date.now() / 86400000);
  const featuredIndex = day % 3;
  
  return CAPSULE_ARCHETYPES.map((capsule, index) => {
    const isFeatured = index === featuredIndex;
    const item = { ...capsule, isFeatured };
    
    // Apply world state hooks
    const globalState = getActiveGlobalState();
    if (globalState) {
      if (globalState.id === 'illustration_boom' && item.id === 'archive') {
        item.signal = 'Illustration Boom: IR probability significantly elevated.';
        item.rarityShaping = { rare: { illustrationRare: 0.15, doubleRare: 0.1, rare: 0.75 } };
      }
      if (globalState.id === 'underground_activity' && item.id === 'distortion') {
        item.signal = 'Underground Activity: Volatility critical.';
        item.rarityShaping = { rare: { secretRare: 0.1, uncommon: 0.4, rare: 0.5 } };
      }
      if (globalState.id === 'archive_prestige_spike' && item.id === 'prism') {
        item.signal = 'Prestige Spike: Collector messaging intensified.';
        item.price = 60;
        item.rarityShaping = { rare: { doubleRare: 0.2, ultraRare: 0.15, secretRare: 0.1, rare: 0.55 } };
      }
    }
    
    return item;
  });
}

// ---------------------- Stock management (local-first, per-day) ----------------
const CAPSULE_STOCK_KEY = 'rarebound_capsule_stock_v1';

function _hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function _seedStocksForDay(day) {
  // Deterministic seeds per day for variety without server dependency
  const archive = 20; // stable moderate inventory
  const distortion = 5 + (_hashString(day + 'distortion') % 21); // 5..25
  const prism = 2 + (_hashString(day + 'prism') % 3); // 2..4 scarce
  return { archive, distortion, prism };
}

function _loadStockState() {
  try {
    const raw = localStorage.getItem(CAPSULE_STOCK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function _saveStockState(state) {
  try { localStorage.setItem(CAPSULE_STOCK_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function getCapsuleStocks() {
  const day = Math.floor(Date.now() / 86400000);
  let state = _loadStockState();
  if (!state || state.day !== day) {
    const seeds = _seedStocksForDay(day);
    state = { day, stocks: { archive: seeds.archive, distortion: seeds.distortion, prism: seeds.prism } };
    _saveStockState(state);
  }
  return state.stocks;
}

export function getCapsuleStock(id) {
  const stocks = getCapsuleStocks();
  return stocks[id] ?? 0;
}

export function tryDispenseCapsule(id) {
  const day = Math.floor(Date.now() / 86400000);
  let state = _loadStockState();
  if (!state || state.day !== day) {
    const seeds = _seedStocksForDay(day);
    state = { day, stocks: { archive: seeds.archive, distortion: seeds.distortion, prism: seeds.prism } };
  }
  const cur = state.stocks[id] ?? 0;
  if (cur <= 0) return false;
  state.stocks[id] = Math.max(0, cur - 1);
  _saveStockState(state);
  return true;
}

export function refreshCapsuleStocks() {
  const day = Math.floor(Date.now() / 86400000);
  const seeds = _seedStocksForDay(day);
  const state = { day, stocks: { archive: seeds.archive, distortion: seeds.distortion, prism: seeds.prism } };
  _saveStockState(state);
  return state.stocks;
}

