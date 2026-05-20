/**
 * data/vendorStateManager.js
 *
 * Phase 2A: Dynamic Vendor State Architecture
 * 
 * A lightweight centralized state manager capable of driving:
 * - rotating world states (Global Market States)
 * - vendor operational states (Moods, Inventory Conditions)
 * 
 * Uses timestamp-based recalculation to avoid heavy intervals.
 */

const STORAGE_KEY = 'tcg_vendor_states';
const GLOBAL_CYCLE_MS = 6 * 60 * 60 * 1000; // 6 hours max duration
const VENDOR_CYCLE_MS = 3 * 60 * 60 * 1000; // 3 hours max duration

export const GLOBAL_STATES = [
  { id: 'fire_type_surge', title: 'Fire-Type Surge', description: 'Elevated demand for Fire-type holographics.', durationMs: 4 * 60 * 60 * 1000, intensity: 1.2 },
  { id: 'illustration_boom', title: 'Illustration Boom', description: 'Alt-art valuations are temporarily expanded.', durationMs: 6 * 60 * 60 * 1000, intensity: 1.5 },
  { id: 'trainer_market_rise', title: 'Trainer Market Rise', description: 'Supporter cards are trending in the secondary market.', durationMs: 4 * 60 * 60 * 1000, intensity: 1.2 },
  { id: 'vintage_interest', title: 'Vintage Interest', description: 'Archival collections are seeing increased foot traffic.', durationMs: 8 * 60 * 60 * 1000, intensity: 1.3 },
  { id: 'sealed_scarcity', title: 'Sealed Scarcity', description: 'Distribution disruptions affecting sealed product availability.', durationMs: 5 * 60 * 60 * 1000, intensity: 1.4 },
  { id: 'modern_fatigue', title: 'Modern Fatigue', description: 'Recent expansions are moving slower than baseline.', durationMs: 3 * 60 * 60 * 1000, intensity: 0.8 },
  { id: 'archive_prestige_spike', title: 'Archive Prestige Spike', description: 'High-grade pristine slabs are fetching premium bounties.', durationMs: 6 * 60 * 60 * 1000, intensity: 1.5 },
  { id: 'underground_activity', title: 'Underground Activity', description: 'Shadow markets are heavily active tonight.', durationMs: 4 * 60 * 60 * 1000, intensity: 1.4 },
  { id: 'museum_restoration_week', title: 'Museum Restoration Week', description: 'Institutions are aggressively sourcing damaged vintage stock.', durationMs: 24 * 60 * 60 * 1000, intensity: 2.0 },
  { id: 'auction_heavy_volume', title: 'Auction Saturated', description: 'Private estates are liquidating at unusually high volume.', durationMs: 12 * 60 * 60 * 1000, intensity: 1.5 },
];

export const VENDOR_OPERATIONAL_STATES = {
  capsuleCorner: [
    { id: 'capsule_automated', label: 'Automated Routing', notice: 'Distribution channels nominal.', glow: 'normal' },
    { id: 'capsule_pressure', label: 'Elevated Pressure', notice: 'Illustration-rare pressure elevated.', glow: 'high' },
    { id: 'capsule_fluctuation', label: 'Integrity Fluctuation', notice: 'Capsule integrity fluctuation detected.', glow: 'unstable' },
    { id: 'capsule_stabilizing', label: 'Channels Stabilizing', notice: 'Sealed distribution channels stabilizing.', glow: 'normal' },
    { id: 'capsule_suppression', label: 'Duplicate Suppression', notice: 'Duplicate suppression operating above baseline.', glow: 'low' },
  ],
  museumExchange: [
    { id: 'museum_curated', label: 'Standard Intake', notice: 'Accepting submissions for review.', glow: 'normal' },
    { id: 'museum_johto', label: 'Johto Restoration', notice: 'Johto restoration program active.', glow: 'high' },
    { id: 'museum_vintage', label: 'Curator Demand', notice: 'Curator demand for vintage illustrations elevated.', glow: 'high' },
    { id: 'museum_expanded', label: 'Expanded Archival', notice: 'Archival preservation intake expanded.', glow: 'high' },
    { id: 'museum_review', label: 'Committee Active', notice: 'Exhibition review committees active.', glow: 'low' },
    { id: 'museum_hoenn', label: 'Maritime Collection', notice: 'Hoenn Maritime Collection exhibition active.', glow: 'high' },
  ],
  estateAuctions: [
    { id: 'estate_private', label: 'Private Lots', notice: 'Standard private collector channels active.', glow: 'normal' },
    { id: 'estate_saturated', label: 'Channels Saturated', notice: 'Private collector channels saturated.', glow: 'high' },
    { id: 'estate_liquidation', label: 'Estate Liquidation', notice: 'Estate liquidation volume elevated.', glow: 'high' },
    { id: 'estate_bidding_war', label: 'Elite Bidding War', notice: 'Elite archival bidding war detected.', glow: 'unstable' },
    { id: 'estate_reserve', label: 'Reserve Pressure', notice: 'Reserve pressure increasing.', glow: 'high' },
  ]
};

// Fallback operational states for other vendors
const DEFAULT_OPERATIONAL_STATES = [
  { id: 'active', label: 'Operating Baseline', notice: 'Operating at baseline capacity.', glow: 'normal' },
  { id: 'elevatedDemand', label: 'Elevated Demand', notice: 'Foot traffic is higher than usual.', glow: 'high' },
  { id: 'lowInventory', label: 'Low Inventory', notice: 'Stock levels are running low.', glow: 'low' },
  { id: 'maintenance', label: 'Restocking', notice: 'Brief operational pause for restocking.', glow: 'low' },
  { id: 'curatorFocused', label: 'Curator Focused', notice: 'Curator is currently reviewing inventory.', glow: 'normal' },
  { id: 'collectorRush', label: 'Collector Rush', notice: 'A sudden rush of collectors is driving prices.', glow: 'unstable' },
];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && typeof raw === 'object') return raw;
  } catch {}
  return { global: null, vendors: {} };
}

function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

/**
 * Lightweight deterministic tick function.
 * Evaluates expiration timestamps and rotates states if necessary.
 */
export function tickVendorStates() {
  const state = load();
  const now = Date.now();
  let changed = false;

  // 1. Global Market State Evaluation
  if (!state.global || now > state.global.expiresAt) {
    // 20% chance for a quiet market (no event)
    if (Math.random() < 0.2) {
      state.global = { id: null, expiresAt: now + (2 * 60 * 60 * 1000) };
    } else {
      const g = GLOBAL_STATES[Math.floor(Math.random() * GLOBAL_STATES.length)];
      state.global = {
        id: g.id,
        expiresAt: now + g.durationMs,
      };
    }
    changed = true;
  }

  // 2. Vendor Operational States Evaluation
  const vendorIds = ['pokemart', 'capsuleCorner', 'retroVault', 'museumExchange', 'nightMarket', 'estateAuctions', 'broker'];
  
  vendorIds.forEach(vid => {
    if (!state.vendors[vid] || now > state.vendors[vid].expiresAt) {
      const pool = VENDOR_OPERATIONAL_STATES[vid] || DEFAULT_OPERATIONAL_STATES;
      const op = pool[Math.floor(Math.random() * pool.length)];
      // Add random fuzziness to expiration (up to 1hr)
      const fuzz = Math.random() * 60 * 60 * 1000;
      state.vendors[vid] = {
        id: op.id,
        expiresAt: now + VENDOR_CYCLE_MS + fuzz
      };
      changed = true;
    }
  });

  if (changed) {
    save(state);
  }
  return changed;
}

/**
 * Returns the currently active global market state object, or null.
 */
export function getActiveGlobalState() {
  const state = load();
  if (state.global && state.global.id) {
    return GLOBAL_STATES.find(g => g.id === state.global.id) || null;
  }
  return null;
}

/**
 * Returns the current operational state object for a given vendor.
 */
export function getVendorOperationalState(vendorId) {
  const state = load();
  const vidState = state.vendors[vendorId];
  if (!vidState) return null;
  
  const pool = VENDOR_OPERATIONAL_STATES[vendorId] || DEFAULT_OPERATIONAL_STATES;
  return pool.find(op => op.id === vidState.id) || null;
}
