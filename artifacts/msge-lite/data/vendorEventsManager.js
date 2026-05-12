/**
 * data/vendorEventsManager.js — v1.4.0
 *
 * Vendor World Events — subtle, atmospheric, rotating events that
 * make the four-vendor economy feel alive. Each vendor independently
 * holds at most one event at a time, with long quiet windows between
 * events so the world never feels event-spammy.
 *
 * Per-vendor cadence:
 *   - 6h evaluation window
 *   - 35% chance to roll a new event when the window expires
 *   - active events last 3h
 *   - quiet period of at least 2h between events
 *
 * Storage: tcg_vendor_events
 *   { [vendorId]: { activeEvent: Event|null, evaluatedAt, eventEndsAt, lastEndedAt } }
 *
 * Effects (queryable via getVendorEventEffect):
 *   - packDiscountPct  (PokéMart "Modern Stock Overflow")
 *   - reverseHoloBoost (Retro Vault "Archive Recovery Week")
 *   - volatilityMult   (Night Market "Shadow Demand Spike")
 *   - chaseStockBoost  (Broker "Prestige Acquisition Window")
 */

const STORAGE_KEY = 'tcg_vendor_events';

const EVAL_WINDOW_MS  = 6 * 60 * 60 * 1000;
const EVENT_DURATION  = 3 * 60 * 60 * 1000;
const QUIET_MIN_MS    = 2 * 60 * 60 * 1000;
const ROLL_CHANCE     = 0.35;

const EVENT_TABLE = {
  pokemart: [
    {
      id: 'pokemart_overflow',
      title: 'Modern Stock Overflow',
      flavor: 'Distribution surplus on the modern shelves — packs lightly discounted.',
      effects: { packDiscountPct: 0.08 },
    },
    {
      id: 'pokemart_quiet_day',
      title: 'Quiet Trading Day',
      flavor: 'Foot traffic is light. The clerk is in a generous mood.',
      effects: { packDiscountPct: 0.05 },
    },
  ],
  retroVault: [
    {
      id: 'retro_archive_recovery',
      title: 'Archive Recovery Week',
      flavor: 'A vintage estate cleared. Reverse-holo finds are turning up.',
      effects: { reverseHoloBoost: 0.20 },
    },
    {
      id: 'retro_curator_visit',
      title: 'Curator on the Floor',
      flavor: 'The senior curator is reviewing inventory personally.',
      effects: { reverseHoloBoost: 0.12 },
    },
  ],
  nightMarket: [
    {
      id: 'night_shadow_spike',
      title: 'Shadow Demand Spike',
      flavor: 'Whispered offers above market. Volatility runs high.',
      effects: { volatilityMult: 1.6 },
    },
    {
      id: 'night_back_alley',
      title: 'Back-Alley Auction',
      flavor: 'A discreet auction draws unusual prices tonight.',
      effects: { volatilityMult: 1.3 },
    },
  ],
  broker: [
    {
      id: 'broker_prestige_window',
      title: 'Prestige Acquisition Window',
      flavor: 'Private clients are competing. Chase inventory is denser than usual.',
      effects: { chaseStockBoost: 0.25 },
    },
    {
      id: 'broker_estate_inflow',
      title: 'Estate Inflow',
      flavor: 'A collector estate has cleared the back room.',
      effects: { chaseStockBoost: 0.15 },
    },
  ],
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && typeof raw === 'object') return raw;
  } catch {}
  return {};
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function defaultSlot() {
  return { activeEvent: null, evaluatedAt: 0, eventEndsAt: 0, lastEndedAt: 0 };
}

function pickEventFor(vendorId) {
  const pool = EVENT_TABLE[vendorId];
  if (!pool || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Evaluate (and possibly rotate) every vendor's event slot.
 * Idempotent: safe to call from the 30s tick.
 * @returns {boolean} true if any vendor's slot changed (caller may re-render).
 */
export function tickVendorEvents() {
  const state = load();
  const now   = Date.now();
  let changed = false;

  for (const vendorId of Object.keys(EVENT_TABLE)) {
    const slot = state[vendorId] || defaultSlot();

    // 1) Expire active event past its window
    if (slot.activeEvent && slot.eventEndsAt && now >= slot.eventEndsAt) {
      slot.activeEvent = null;
      slot.lastEndedAt = slot.eventEndsAt;
      slot.eventEndsAt = 0;
      changed = true;
    }

    // 2) Evaluate next window if expired and not currently active
    if (!slot.activeEvent && now - slot.evaluatedAt >= EVAL_WINDOW_MS) {
      slot.evaluatedAt = now;
      const cooledDown = !slot.lastEndedAt || (now - slot.lastEndedAt) >= QUIET_MIN_MS;
      if (cooledDown && Math.random() < ROLL_CHANCE) {
        const ev = pickEventFor(vendorId);
        if (ev) {
          slot.activeEvent = ev;
          slot.eventEndsAt = now + EVENT_DURATION;
          changed = true;
        }
      }
    }

    state[vendorId] = slot;
  }
  if (changed) save(state);
  return changed;
}

/** Returns the active event for a vendor, or null. Read-only. */
export function getVendorEvent(vendorId) {
  const slot = load()[vendorId];
  if (!slot || !slot.activeEvent) return null;
  if (slot.eventEndsAt && Date.now() >= slot.eventEndsAt) return null;
  return slot.activeEvent;
}

/** Convenience: returns just the effect bag merged with safe defaults. */
export function getVendorEventEffect(vendorId) {
  const ev = getVendorEvent(vendorId);
  return ev?.effects ? { ...ev.effects } : {};
}

/** Time remaining (ms) on the active event, 0 if none. */
export function getVendorEventTimeLeft(vendorId) {
  const slot = load()[vendorId];
  if (!slot?.activeEvent || !slot.eventEndsAt) return 0;
  return Math.max(0, slot.eventEndsAt - Date.now());
}

/** Dev/diagnostics — wipe all vendor events. */
export function clearAllVendorEvents() {
  localStorage.removeItem(STORAGE_KEY);
}
