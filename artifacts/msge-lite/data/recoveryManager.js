/**
 * data/recoveryManager.js — v1.3.0a (Phase A)
 *
 * Central orchestrator for Recovery Mode.
 *
 * Recovery Mode activates when isInDistress() (balance < $8). The system layers:
 *   - Per-vendor flavor messaging on the banner (rotating with focus vendor)
 *   - One vendor holds the "Emergency Request" focus, rotating every 45 minutes
 *   - Failsafe Vendor Relief Stipend (24h cooldown, $15-25, no rep / no favor)
 *   - Per-vendor recovery acceptance (PokéMart always, Retro Vault gated by
 *     favor>=15 OR rank>=Collector, Night Market always (volatile), Broker
 *     hidden except for Master Collector+ prestige liquidations)
 *
 * Storage: tcg_recovery_state → { lastReliefTs, focusVendorId, focusRotatedAt }
 *
 * Save migration: defaults are returned for any missing key, so old saves
 * upgrade transparently with no wipe.
 */

import { isInDistress }                from './distressManager.js';
import { getFavorLevel }               from './vendorManager.js';
import { getRank }                     from './reputationManager.js';
import { addBalance }                  from '../state/playerState.js';

const KEY                  = 'tcg_recovery_state';
// Cross-module key constant (mirrored in emergencyRequestManager.js to
// avoid a circular import). When focus rotates or recovery exits we wipe
// this storage directly so emergency requests stay in lockstep with the
// focus vendor and never leak across recovery sessions.
const EMERGENCY_KEY        = 'tcg_emergency_requests';
const FOCUS_ROTATION_MS    = 45 * 60 * 1000;
const RELIEF_COOLDOWN_MS   = 24 * 60 * 60 * 1000;
const RELIEF_RANGE         = [15, 25];

// All vendors are eligible to hold the focus; vendorAcceptsRecovery() is the
// per-vendor gate.
const FOCUS_CANDIDATES = ['pokemart', 'retroVault', 'nightMarket', 'broker'];

// Flavor lines per vendor. The active line is picked deterministically from
// focusRotatedAt so it stays stable for the whole 45-min window.
const VENDOR_RECOVERY_FLAVOR = {
  pokemart: [
    'PokéMart has prepared emergency collector work.',
    'PokéMart is hiring duplicate-runners — see the request board.',
    'PokéMart will buy thinned-out duplicates while supplies last.',
  ],
  retroVault: [
    'Archive liquidation opportunities available.',
    'The Vault is quietly accepting older inventory.',
    'Retro Vault opens its archives to trusted collectors.',
  ],
  nightMarket: [
    'Desperate collectors attract dangerous offers.',
    'The Night Market notices when wallets run thin.',
    'Volatile contracts surface in the back alleys tonight.',
  ],
  broker: [
    'The Broker has suspended prestige inventory.',
    'The Broker does not extend trust to unstable collectors.',
    'Prestige acquisitions remain closed until your accounts recover.',
  ],
};

const VENDOR_DISPLAY_NAME = {
  pokemart:    'PokéMart',
  retroVault:  'Retro Vault',
  nightMarket: 'Night Market',
  broker:      'The Broker',
};

const RANK_ORDER = [
  'Rookie Collector', 'Collector', 'Advanced Collector',
  'Elite Collector', 'Master Collector', 'Archive Curator', 'Legendary Collector',
];

function rankIndex(name) {
  const i = RANK_ORDER.indexOf(name);
  return i < 0 ? 0 : i;
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

/** True iff the player is in financial recovery territory. */
export function isInRecovery() {
  return isInDistress();
}

/**
 * Per-vendor recovery acceptance gate. Only vendors that return true here
 * will surface an Emergency Request slot — and only one of them at a time
 * holds the rotating focus.
 *
 * - pokemart:    always reliable
 * - retroVault:  favor level >= 3 (mid-tier) OR rank >= Collector
 * - nightMarket: always present, but volatile
 * - broker:      Master Collector or higher only (prestige liquidation)
 */
export function vendorAcceptsRecovery(vendorId) {
  if (!isInRecovery()) return false;
  if (vendorId === 'pokemart')    return true;
  if (vendorId === 'nightMarket') return true;
  if (vendorId === 'retroVault') {
    if ((getFavorLevel('retroVault') ?? 0) >= 3) return true;
    return rankIndex(getRank().name) >= rankIndex('Collector');
  }
  if (vendorId === 'broker') {
    return rankIndex(getRank().name) >= rankIndex('Master Collector');
  }
  return false;
}

/**
 * Returns the vendor ID currently holding the Emergency Request focus,
 * or null when not in recovery. Rotates every FOCUS_ROTATION_MS to a new
 * accepting vendor (falls back to pokemart if nothing else qualifies).
 */
export function getRecoveryFocusVendor() {
  if (!isInRecovery()) return null;
  const state = load();
  const now   = Date.now();
  const stale = !state.focusVendorId
    || (now - (state.focusRotatedAt || 0)) >= FOCUS_ROTATION_MS;
  // Also rotate if the previously focused vendor has since become ineligible
  // (e.g. player dropped below favor threshold for retroVault — unlikely
  // since favor only grows, but defensive).
  const stillEligible = state.focusVendorId
    ? vendorAcceptsRecovery(state.focusVendorId)
    : false;

  if (stale || !stillEligible) {
    const accepting = FOCUS_CANDIDATES.filter(vendorAcceptsRecovery);
    state.focusVendorId  = accepting.length > 0
      ? accepting[Math.floor(Math.random() * accepting.length)]
      : 'pokemart';
    state.focusRotatedAt = now;
    save(state);
    // Lockstep: any pre-existing emergency request belongs to the previous
    // focus vendor and must be wiped so the new focus generates a fresh
    // contract on next render.
    localStorage.removeItem(EMERGENCY_KEY);
  }
  return state.focusVendorId;
}

/** Banner flavor text, picked deterministically per rotation window. */
export function getRecoveryBannerMessage() {
  const focus = getRecoveryFocusVendor();
  if (!focus) return '';
  const flavors = VENDOR_RECOVERY_FLAVOR[focus] || [];
  if (flavors.length === 0) return '';
  const state = load();
  const seed  = Math.abs(state.focusRotatedAt || 0) % flavors.length;
  return flavors[seed];
}

/** Display name of the current focus vendor (e.g. "PokéMart"). */
export function getRecoveryFocusName() {
  const focus = getRecoveryFocusVendor();
  return VENDOR_DISPLAY_NAME[focus] || '';
}

/** ms until the next focus rotation. */
export function timeUntilFocusRotationMs() {
  const state = load();
  if (!state.focusRotatedAt) return 0;
  return Math.max(0, FOCUS_ROTATION_MS - (Date.now() - state.focusRotatedAt));
}

// ─── Vendor Relief Stipend (failsafe, 24h cooldown) ──────────────────────────

export function timeUntilReliefMs() {
  const s = load();
  if (!s.lastReliefTs) return 0;
  return Math.max(0, RELIEF_COOLDOWN_MS - (Date.now() - s.lastReliefTs));
}

export function canClaimRelief() {
  return isInRecovery() && timeUntilReliefMs() === 0;
}

export function getReliefCountdownLabel() {
  const ms = timeUntilReliefMs();
  if (ms === 0) return 'Available';
  const totalM = Math.ceil(ms / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Stable amount within a single calendar day. Same as the daily stipend
 * pattern — seeded by day index so the player can't refresh-shop for
 * a higher roll.
 */
export function getReliefAmount() {
  const dayKey = Math.floor(Date.now() / 86_400_000);
  const seed   = ((dayKey * 4_283 + 17_011) % 100_003) / 100_003;
  return Math.round(RELIEF_RANGE[0] + seed * (RELIEF_RANGE[1] - RELIEF_RANGE[0]));
}

/** Grants the relief stipend if eligible. Returns the amount granted, or 0. */
export function claimReliefStipend() {
  if (!canClaimRelief()) return 0;
  const amt = getReliefAmount();
  addBalance(amt);
  const s = load();
  s.lastReliefTs = Date.now();
  save(s);
  return amt;
}

/**
 * Clear all recovery artifacts (state + emergency requests) when the player
 * is no longer in distress. Idempotent — safe to call from a periodic tick.
 *
 * Returns true if anything was actually cleaned up (so the caller can
 * trigger a re-render).
 */
export function cleanupIfRecovered() {
  if (isInRecovery()) return false;
  const hadState     = localStorage.getItem(KEY) !== null;
  const hadEmergency = localStorage.getItem(EMERGENCY_KEY) !== null;
  if (!hadState && !hadEmergency) return false;
  localStorage.removeItem(KEY);
  localStorage.removeItem(EMERGENCY_KEY);
  return true;
}

/**
 * Periodic recovery tick — call this from the existing 30 s top-level
 * setInterval. Returns true when the caller should re-render the Vendor
 * Hub (focus rotated or post-recovery cleanup ran).
 *
 * Two responsibilities:
 *   1) If in recovery and the focus window has expired, advance the focus
 *      vendor proactively (via a getRecoveryFocusVendor() call which
 *      also wipes the stale emergency slot in lockstep).
 *   2) If no longer in recovery, drop any leftover state so a fresh
 *      distress event starts clean.
 */
export function tickRecovery() {
  if (isInRecovery()) {
    if (timeUntilFocusRotationMs() === 0) {
      getRecoveryFocusVendor();   // triggers rotation + emergency wipe
      return true;
    }
    return false;
  }
  return cleanupIfRecovered();
}

/** Dev tool — wipe recovery state. */
export function clearRecoveryState() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(EMERGENCY_KEY);
}
