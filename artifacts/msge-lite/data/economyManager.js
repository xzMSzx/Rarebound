/**
 * data/economyManager.js — Phase 9
 *
 * Central economy orchestrator. Owns refresh cycles, trends, market drift,
 * and vendor stock rotation. All other economy modules call into this.
 *
 * Storage key: tcg_economy → { lastRefreshTs, trendId }
 *
 * Refresh cycle (DEV): 30 minutes.
 * The architecture supports a 24-hour cycle by changing REFRESH_INTERVAL_MS.
 */

import { tickMarketValues } from './marketValue.js';
import { regenerateAllVendorStocks } from './vendorManager.js';
import { ensureDailyChase } from './chaseManager.js';

const STORAGE_KEY        = 'tcg_economy';
export const REFRESH_INTERVAL_MS = 30 * 60 * 1000;   // 30 min in dev

// ─── Trend pool ───────────────────────────────────────────────────────────────

export const TRENDS = [
  { id: 'fire',        label: 'Fire-type cards trending',     types: ['Fire'],        multiplier: 1.06 },
  { id: 'water',       label: 'Water-type demand surging',    types: ['Water'],       multiplier: 1.05 },
  { id: 'dragon',      label: 'Dragon-type interest rising',  types: ['Dragon'],      multiplier: 1.07 },
  { id: 'vintage',     label: 'Vintage Sword & Shield rising', sets: ['swsh7','swsh11'], multiplier: 1.05 },
  { id: 'illust',      label: 'Illustration rares surging',   rarities: ['illustrationRare','specialIllustrationRare'], multiplier: 1.08 },
  { id: 'hyper',       label: 'Hyper rare collector hype',    rarities: ['hyperRare'], multiplier: 1.1 },
  { id: 'trainerCool', label: 'Trainer cards cooling',        rarities: ['rare','holoRare'], multiplier: 0.95 },
  { id: 'paldea',      label: 'Paldea sets in demand',        sets: ['sv2','sv3pt5','sv4pt5'], multiplier: 1.04 },
];

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Bootstrap: ensures state exists; runs a refresh tick if interval elapsed. */
export function initEconomy() {
  const s = loadState();
  if (!s.lastRefreshTs) {
    s.lastRefreshTs = Date.now();
    s.trendId       = TRENDS[Math.floor(Math.random() * TRENDS.length)].id;
    saveState(s);
    regenerateAllVendorStocks();
    return;
  }
  if (Date.now() - s.lastRefreshTs >= REFRESH_INTERVAL_MS) {
    runRefresh();
  }
}

/** Forces a full economy refresh now. */
export function runRefresh() {
  const s = loadState();
  s.lastRefreshTs = Date.now();
  // Pick a different trend than last time
  const others    = TRENDS.filter(t => t.id !== s.trendId);
  s.trendId       = (others[Math.floor(Math.random() * others.length)] || TRENDS[0]).id;
  saveState(s);

  tickMarketValues(getCurrentTrend());
  regenerateAllVendorStocks();
  // Try to rotate the daily chase; safe no-op until cards are loaded.
  try { ensureDailyChase(); } catch { /* noop */ }
}

/** Daily-chase rotation that also calls into chaseManager. Public so the UI
 *  can fire it once card pools finish preloading on first visit. */
export function tryGenerateDailyChase() { try { return ensureDailyChase(); } catch { return null; } }

export function getCurrentTrend() {
  const s = loadState();
  return TRENDS.find(t => t.id === s.trendId) || TRENDS[0];
}

export function timeUntilRefreshMs() {
  const s = loadState();
  if (!s.lastRefreshTs) return REFRESH_INTERVAL_MS;
  return Math.max(0, REFRESH_INTERVAL_MS - (Date.now() - s.lastRefreshTs));
}

/** Compact human label like "23m" or "1h 12m". */
export function getRefreshLabel() {
  const ms      = timeUntilRefreshMs();
  const totalM  = Math.ceil(ms / 60000);
  const h       = Math.floor(totalM / 60);
  const m       = totalM % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${totalM}m`;
}
