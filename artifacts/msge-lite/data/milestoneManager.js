/**
 * data/milestoneManager.js — v1.3.0 (Phase B of "Recovery & Longevity")
 *
 * Collector milestone system — nine themed categories, ~71 milestones,
 * progressive revelation, reputation + cash rewards.
 *
 * Design rules:
 *  - Rewards are meaningful but not economy-breaking (modest cash, rep)
 *  - Progressive revelation: each category shows the first 3 milestones
 *    plus one beyond the last claimed — so you always have a reachable
 *    next goal without the full menu being spoiled up front.
 *  - Stats-based milestones (packs, sells, requests) read from
 *    statsManager — never from DOM or call sites.
 *  - Reputation-based milestones derive from reputationManager.
 *  - Vendor-loyalty milestones derive from vendorManager.getFavorLevel().
 *  - All existing milestone IDs from v1.1.x / v1.2.x are preserved; new
 *    ones in v1.3.0 are additive so old saves aren't corrupted.
 *
 * Storage key: tcg_milestones → { claimed: string[] }
 */

import { getCollection as _getCollection } from './collectionManager.js';

// ⚡ Bolt: Scoped cache for the collection object.
// We use this to prevent redundant localStorage parses during a single milestone sweep.
let _sweepCollection = null;
function getCollection() {
  return _sweepCollection || _getCollection();
}
import { getCachedSetCards } from './cardPoolManager.js';
import { mapPokemonRarity }  from './rarityMapper.js';
import { getReputation }     from './reputationManager.js';
import { getFavorLevel }     from './vendorManager.js';
import { isPlainObject, readJson, writeJson } from './persistenceStore.js';
import {
  getPacksOpened,
  getDuplicatesSold,
  getRequestsCompleted,
  getLifetimeRevenue,
  getBrokerPurchases,
  hasDistressRecovered,
} from './statsManager.js';

const STORAGE_KEY = 'tcg_milestones';

const HOLO_TIERS   = new Set([
  'holoRare','doubleRare','illustrationRare',
  'ultraRare','specialIllustrationRare','hyperRare',
]);
const SECRET_TIERS = new Set(['specialIllustrationRare','hyperRare']);
const ULTRA_TIERS  = new Set(['ultraRare','specialIllustrationRare','hyperRare']);
const DOUBLE_TIERS = new Set(['doubleRare']);
const ILLO_TIERS   = new Set(['illustrationRare']);

const VENDOR_IDS   = ['pokemart', 'retroVault', 'nightMarket', 'broker'];

// ─── Milestone categories ─────────────────────────────────────────────────────

export const CATEGORIES = [
  {
    id:    'collection',
    label: 'Collection',
    icon:  '◈',
    milestones: [
      { id: 'unique25',       title: 'Budding Collector',  desc: 'Own 25 unique cards.',                                   rewardCash: 20,  rewardRep: 10 },
      { id: 'unique75',       title: 'Growing Archive',    desc: 'Own 75 unique cards.',                                   rewardCash: 35,  rewardRep: 20 },
      { id: 'unique150',      title: 'Curated Catalogue',  desc: 'Own 150 unique cards.',                                  rewardCash: 60,  rewardRep: 35 },
      { id: 'setQuarter',     title: 'Quarter Binder',     desc: 'Reach 25% completion in any set.',                       rewardCash: 40,  rewardRep: 0,  rewardNote: '+50 PokéMart Favor' },
      { id: 'setHalf',        title: 'Halfway There',      desc: 'Reach 50% completion in any set.',                       rewardCash: 75,  rewardRep: 25 },
      { id: 'completeAnySet', title: 'Set Completionist',  desc: 'Complete any set in full.',                              rewardCash: 150, rewardRep: 50, rewardNote: 'Archive Badge unlocked' },
      { id: 'unique250',      title: 'Established Library',desc: 'Own 250 unique cards.',                                  rewardCash: 100, rewardRep: 60,  rewardPrestige: 25 },
      { id: 'unique500',      title: 'Master Catalogue',   desc: 'Own 500 unique cards.',                                  rewardCash: 0,   rewardRep: 150, rewardPrestige: 80, rewardArchive: 'Reached the Master Catalogue tier — 500 unique cards archived.' },
    ],
  },
  {
    id:    'packOpening',
    label: 'Pack Opening',
    icon:  '⬡',
    milestones: [
      { id: 'packs10',         title: 'First Runs',         desc: 'Open 10 packs.',                                                       rewardCash: 15,  rewardRep: 0  },
      { id: 'packs25',         title: 'Regular Opener',     desc: 'Open 25 packs.',                                                       rewardCash: 30,  rewardRep: 0  },
      { id: 'packs50',         title: 'Dedicated Collector',desc: 'Open 50 packs.',                                                       rewardCash: 60,  rewardRep: 10 },
      { id: 'holoFirst',       title: 'First Holo',         desc: 'Pull your first Holo Rare or higher.',                                 rewardCash: 15,  rewardRep: 5  },
      { id: 'ultraRareFirst',  title: 'First Ultra Pull',   desc: 'Pull your first Ultra Rare, Special Illustration Rare, or Hyper Rare.',rewardCash: 25,  rewardRep: 15 },
      { id: 'secretRareFirst', title: 'Secret Discovery',   desc: 'Pull your first Secret Rare (Hyper or Special Illustration).',         rewardCash: 75,  rewardRep: 35 },
      { id: 'packs100',        title: 'Century Opener',     desc: 'Open 100 packs.',                                                      rewardCash: 120, rewardRep: 20 },
      { id: 'ultraRareDup',    title: 'Repeat Pull',        desc: 'Own 2+ of any Ultra Rare or higher card.',                             rewardCash: 80,  rewardRep: 30 },
    ],
  },
  {
    id:    'economy',
    label: 'Market & Economy',
    icon:  '◎',
    milestones: [
      { id: 'duplicatesSold10', title: 'Smart Seller',       desc: 'Sell 10 duplicate cards to vendors.',                                 rewardCash: 20, rewardRep: 0  },
      { id: 'requests5',        title: 'Trusted Supplier',   desc: 'Complete 5 vendor requests.',                                         rewardCash: 30, rewardRep: 0,  rewardNote: '+30 Favor (all vendors)' },
      { id: 'revenue500',       title: 'Half Grand',         desc: 'Earn $500 in lifetime revenue from selling and requests.',            rewardCash: 50, rewardRep: 0  },
      { id: 'requests20',       title: 'Contract Specialist',desc: 'Complete 20 vendor requests.',                                        rewardCash: 80, rewardRep: 25 },
      { id: 'brokerFirst',      title: 'Broker Clientele',   desc: 'Purchase your first card from the Broker.',                           rewardCash: 0,  rewardRep: 40 },
      { id: 'distressRecovered',title: 'Recovered Collector',desc: 'Recover from financial distress (balance below $8).',                 rewardCash: 0,  rewardRep: 0,  rewardNote: '"Recovered Collector" archive tag' },
    ],
  },
  {
    id:    'reputation',
    label: 'Reputation',
    icon:  '◈',
    milestones: [
      { id: 'rankCollector', title: 'Established Name',  desc: 'Reach Collector rank (100 reputation).',           rewardCash: 10, rewardRep: 0, rewardNote: 'Stipend increases to $18' },
      { id: 'rankAdvanced',  title: 'Advanced Standing', desc: 'Reach Advanced Collector rank (400 reputation).',  rewardCash: 15, rewardRep: 0, rewardNote: 'Stipend increases to $28' },
      { id: 'rankElite',     title: 'Elite Presence',    desc: 'Reach Elite Collector rank (1,000 reputation).',   rewardCash: 20, rewardRep: 0, rewardNote: 'Stipend increases to $40' },
      { id: 'rankMaster',    title: 'Master Collector',  desc: 'Reach Master Collector rank (2,500 reputation).',  rewardCash: 25, rewardRep: 0, rewardNote: 'Stipend increases to $50' },
      { id: 'rankCurator',   title: 'Archive Curator',   desc: 'Reach Archive Curator rank (5,000 reputation).',   rewardCash: 35, rewardRep: 0, rewardNote: 'Stipend increases to $60' },
      { id: 'rankLegendary', title: 'Legendary Collector',desc:'Reach Legendary Collector rank (10,000 reputation).',rewardCash: 0, rewardRep: 0, rewardPrestige: 200, rewardArchive: 'Reached Legendary Collector — archive recognition at the highest tier.' },
    ],
  },
  {
    id:    'rareHunter',
    label: 'Rare Hunter',
    icon:  '✦',
    milestones: [
      { id: 'holo10',     title: 'Holo Hunter',      desc: 'Own 10 holo or higher rarity cards.',                                 rewardCash: 35,  rewardRep: 10 },
      { id: 'holo25',     title: 'Holo Wall',        desc: 'Own 25 holo or higher rarity cards.',                                 rewardCash: 60,  rewardRep: 20 },
      { id: 'holo50',     title: 'Brilliant Shelf',  desc: 'Own 50 holo or higher rarity cards.',                                 rewardCash: 60, rewardRep: 40, rewardPrestige: 30, rewardFavor: { vendorId: 'retroVault', amount: 25 } },
      { id: 'ultraRare3', title: 'Ultra Collection', desc: 'Own 3 Ultra Rare or higher cards.',                                   rewardCash: 40,  rewardRep: 0  },
      { id: 'secretFirst',title: 'Secret Shelf',     desc: 'Own at least 1 Secret Rare (Hyper or Special Illustration).',         rewardCash: 75,  rewardRep: 0  },
      { id: 'secrets3',   title: 'Trio of Secrets',  desc: 'Own 3 Secret Rares.',                                                 rewardCash: 110, rewardRep: 30 },
      { id: 'secrets5',   title: 'Vault of Secrets', desc: 'Own 5 Secret Rares.',                                                 rewardCash: 150, rewardRep: 50 },
      { id: 'secretDup',  title: 'Duplicate Treasure',desc:'Pull a duplicate Secret Rare (own 2+ of any hyper or SIR).',          rewardCash: 100, rewardRep: 0,  rewardNote: 'Special archive notification' },
    ],
  },
  // ─── v1.3.0 NEW CATEGORIES ──────────────────────────────────────────────────
  {
    id:    'vendorLoyalty',
    label: 'Vendor Loyalty',
    icon:  '☗',
    milestones: [
      { id: 'pokemartFavor3', title: 'Friend of PokéMart',     desc: 'Reach favor level 3 with PokéMart.',           rewardCash: 25,  rewardRep: 10 },
      { id: 'pokemartFavor5', title: 'PokéMart Regular',       desc: 'Reach max favor (level 5) with PokéMart.',     rewardCash: 60,  rewardRep: 30 },
      { id: 'retroFavor3',    title: 'Retro Vault Member',     desc: 'Reach favor level 3 with Retro Vault.',        rewardCash: 35,  rewardRep: 15 },
      { id: 'retroFavor5',    title: 'Vault Insider',          desc: 'Reach max favor (level 5) with Retro Vault.',  rewardCash: 80,  rewardRep: 40 },
      { id: 'nightFavor3',    title: 'Night Market Familiar',  desc: 'Reach favor level 3 with Night Market.',       rewardCash: 35,  rewardRep: 15 },
      { id: 'nightFavor5',    title: 'Shadow Buyer',           desc: 'Reach max favor (level 5) with Night Market.', rewardCash: 90,  rewardRep: 45 },
      { id: 'brokerFavor3',   title: 'Broker Acquaintance',    desc: 'Reach favor level 3 with The Broker.',         rewardCash: 50,  rewardRep: 25 },
      { id: 'brokerFavor5',   title: 'Broker Confidant',       desc: 'Reach max favor (level 5) with The Broker.',   rewardCash: 150, rewardRep: 75 },
      { id: 'allFavor2',      title: 'Familiar Face',          desc: 'Reach favor level 2 with all four vendors.',   rewardCash: 60,  rewardRep: 30 },
      { id: 'allFavor3',      title: 'Network Builder',        desc: 'Reach favor level 3 with all four vendors.',   rewardCash: 200, rewardRep: 100, rewardNote: 'Cross-vendor bonus' },
    ],
  },
  {
    id:    'setMastery',
    label: 'Set Mastery',
    icon:  '◇',
    milestones: [
      { id: 'sets3Touched',   title: 'Branching Out',     desc: 'Own at least one card from 3 different sets.',          rewardCash: 25,  rewardRep: 10 },
      { id: 'sets10Touched',  title: 'Across Eras',       desc: 'Own at least one card from 10 different sets.',         rewardCash: 60,  rewardRep: 30 },
      { id: 'sets25Touched',  title: 'Spanning Archive',  desc: 'Own at least one card from 25 different sets.',         rewardCash: 150, rewardRep: 80 },
      { id: 'setsHalf2',      title: 'Two Halves',        desc: 'Reach 50% completion in 2 different sets.',             rewardCash: 80,  rewardRep: 30 },
      { id: 'setsHalf5',      title: 'Five-Set Front',    desc: 'Reach 50% completion in 5 different sets.',             rewardCash: 200, rewardRep: 100 },
      { id: 'setsComplete2',  title: 'Twin Binders',      desc: 'Complete 2 sets in full.',                              rewardCash: 250, rewardRep: 100 },
      { id: 'setsComplete5',  title: 'Set Master',        desc: 'Complete 5 sets in full.',                              rewardCash: 500, rewardRep: 250, rewardNote: 'Archive Curator standing' },
      { id: 'setsComplete10', title: 'Total Curator',     desc: 'Complete 10 sets in full.',                             rewardCash: 1000,rewardRep: 500, rewardNote: 'Legendary Curator standing' },
    ],
  },
  {
    id:    'discovery',
    label: 'Discovery',
    icon:  '✧',
    milestones: [
      { id: 'rarity3',          title: 'Rarity Sampler',     desc: 'Own cards from 3 distinct rarity tiers.',                rewardCash: 25,  rewardRep: 10 },
      { id: 'rarity6',          title: 'Rarity Connoisseur', desc: 'Own cards from 6 distinct rarity tiers.',                rewardCash: 75,  rewardRep: 40 },
      { id: 'rarityAll',        title: 'Full Spectrum',      desc: 'Own cards from every rarity tier in the game.',          rewardCash: 250, rewardRep: 150, rewardNote: 'Achievement showcase' },
      { id: 'doubleRare5',      title: 'Double Down',        desc: 'Own 5 Double Rare cards.',                               rewardCash: 60,  rewardRep: 25 },
      { id: 'illustrationRare5',title: 'Illustrator Series', desc: 'Own 5 Illustration Rare cards.',                         rewardCash: 100, rewardRep: 50 },
      { id: 'ultraRare10',      title: 'Ultra Squad',        desc: 'Own 10 Ultra Rare or higher cards.',                     rewardCash: 150, rewardRep: 75 },
      { id: 'secrets10',        title: 'Secret Society',     desc: 'Own 10 Secret Rares.',                                   rewardCash: 0, rewardRep: 100, rewardPrestige: 60, rewardDiscount: { vendorId: 'broker', pct: 0.05, durationMs: 12 * 60 * 60 * 1000 } },
      { id: 'broker5',          title: 'Repeat Buyer',       desc: 'Purchase 5 cards from the Broker.',                      rewardCash: 75,  rewardRep: 50 },
      { id: 'broker25',         title: 'Major Client',       desc: 'Purchase 25 cards from the Broker.',                     rewardCash: 350, rewardRep: 250, rewardNote: 'Premier Broker standing' },
    ],
  },
  {
    id:    'endurance',
    label: 'Endurance',
    icon:  '◉',
    milestones: [
      { id: 'packs250',          title: 'Veteran Opener',    desc: 'Open 250 packs.',                                                rewardCash: 250, rewardRep: 80  },
      { id: 'packs500',          title: 'Tireless Hands',    desc: 'Open 500 packs.',                                                rewardCash: 500, rewardRep: 200 },
      { id: 'packs1000',         title: 'Legendary Opener',  desc: 'Open 1,000 packs.',                                              rewardCash: 250, rewardRep: 300, rewardPrestige: 120, rewardArchive: 'Opened 1,000 packs — a milestone of pure dedication.' },
      { id: 'revenue2000',       title: 'Two Grand',         desc: 'Earn $2,000 in lifetime revenue.',                               rewardCash: 200, rewardRep: 50  },
      { id: 'revenue10000',      title: 'Five-Figure Trader',desc: 'Earn $10,000 in lifetime revenue.',                              rewardCash: 750, rewardRep: 300 },
      { id: 'duplicatesSold50',  title: 'Volume Seller',     desc: 'Sell 50 duplicate cards to vendors.',                            rewardCash: 100, rewardRep: 30  },
      { id: 'duplicatesSold200', title: 'Wholesale Operator',desc: 'Sell 200 duplicate cards to vendors.',                           rewardCash: 350, rewardRep: 150 },
      { id: 'requests50',        title: 'Career Supplier',   desc: 'Complete 50 vendor requests.',                                   rewardCash: 250, rewardRep: 120 },
    ],
  },
];

// Flat list for backward compat (autoClaimReadyMilestones returns from this)
export const MILESTONES = CATEGORIES.flatMap(c => c.milestones);

// ─── Persistence ──────────────────────────────────────────────────────────────

function load() {
  const raw = readJson(STORAGE_KEY, { claimed: [] }, isPlainObject).value;
  return { claimed: Array.isArray(raw.claimed) ? raw.claimed : [] };
}
function save(s) { return writeJson(STORAGE_KEY, s); }

// ─── Progress computations ────────────────────────────────────────────────────

function countUnique() {
  const c = getCollection();
  let n = 0;
  for (const setId of Object.keys(c)) n += Object.keys(c[setId]).length;
  return n;
}

function countByTiers(tiers) {
  const c = getCollection();
  let n = 0;
  for (const setId of Object.keys(c)) {
    const cached = getCachedSetCards(setId) || [];
    // ⚡ Bolt: Convert O(N*M) array find to O(N+M) Map lookup
    const byId = new Map(cached.map(x => [x.id, x]));
    for (const cardId of Object.keys(c[setId])) {
      const api = byId.get(cardId);
      if (api && tiers.has(mapPokemonRarity(api.rarity))) n++;
    }
  }
  return n;
}

function countByTiersOwning(tiers, minCount = 1) {
  const c = getCollection();
  let n = 0;
  for (const setId of Object.keys(c)) {
    const cached = getCachedSetCards(setId) || [];
    // ⚡ Bolt: Convert O(N*M) array find to O(N+M) Map lookup
    const byId = new Map(cached.map(x => [x.id, x]));
    for (const [cardId, entry] of Object.entries(c[setId])) {
      if (entry.count < minCount) continue;
      const api = byId.get(cardId);
      if (api && tiers.has(mapPokemonRarity(api.rarity))) n++;
    }
  }
  return n;
}

function hasDuplicateSecret() { return countByTiersOwning(SECRET_TIERS, 2) > 0; }
function hasDuplicateUltra()  { return countByTiersOwning(ULTRA_TIERS, 2) > 0; }

function maxSetCompletionPct() {
  const c = getCollection();
  let best = 0;
  for (const setId of Object.keys(c)) {
    const cached = getCachedSetCards(setId) || [];
    if (cached.length === 0) continue;
    const pct = Object.keys(c[setId]).length / cached.length;
    if (pct > best) best = pct;
  }
  return best;
}

function setCompletionsAtLeast(threshold) {
  const c = getCollection();
  let n = 0;
  for (const setId of Object.keys(c)) {
    const cached = getCachedSetCards(setId) || [];
    if (cached.length === 0) continue;
    const pct = Object.keys(c[setId]).length / cached.length;
    if (pct >= threshold) n++;
  }
  return n;
}

function countSetsTouched() {
  return Object.keys(getCollection()).length;
}

function hasCompletedAnySet() { return setCompletionsAtLeast(1.0) > 0; }

function countDistinctRarities() {
  const c = getCollection();
  const seen = new Set();
  for (const setId of Object.keys(c)) {
    const cached = getCachedSetCards(setId) || [];
    // ⚡ Bolt: Convert O(N*M) array find to O(N+M) Map lookup
    const byId = new Map(cached.map(x => [x.id, x]));
    for (const cardId of Object.keys(c[setId])) {
      const api = byId.get(cardId);
      if (api) seen.add(mapPokemonRarity(api.rarity));
    }
  }
  return seen.size;
}

function vendorsAtFavor(level) {
  return VENDOR_IDS.filter(id => getFavorLevel(id) >= level).length;
}

function progressFor(id) {
  switch (id) {
    // Collection
    case 'unique25':       { const v = countUnique(); return { current: v, target: 25 }; }
    case 'unique75':       { const v = countUnique(); return { current: v, target: 75 }; }
    case 'unique150':      { const v = countUnique(); return { current: v, target: 150 }; }
    case 'unique250':      { const v = countUnique(); return { current: v, target: 250 }; }
    case 'unique500':      { const v = countUnique(); return { current: v, target: 500 }; }
    case 'setQuarter':     { const v = maxSetCompletionPct(); return { current: Math.min(v, 0.25), target: 0.25, displayFn: p => `${(p * 100).toFixed(0)}%` }; }
    case 'setHalf':        { const v = maxSetCompletionPct(); return { current: Math.min(v, 0.50), target: 0.50, displayFn: p => `${(p * 100).toFixed(0)}%` }; }
    case 'completeAnySet': { const v = hasCompletedAnySet() ? 1 : 0; return { current: v, target: 1 }; }

    // Pack Opening
    case 'packs10':        { const v = getPacksOpened(); return { current: v, target: 10 }; }
    case 'packs25':        { const v = getPacksOpened(); return { current: v, target: 25 }; }
    case 'packs50':        { const v = getPacksOpened(); return { current: v, target: 50 }; }
    case 'packs100':       { const v = getPacksOpened(); return { current: v, target: 100 }; }
    case 'packs250':       { const v = getPacksOpened(); return { current: v, target: 250 }; }
    case 'packs500':       { const v = getPacksOpened(); return { current: v, target: 500 }; }
    case 'packs1000':      { const v = getPacksOpened(); return { current: v, target: 1000 }; }
    case 'holoFirst':      { const v = countByTiers(HOLO_TIERS) > 0 ? 1 : 0; return { current: v, target: 1 }; }
    case 'ultraRareFirst': { const v = countByTiers(ULTRA_TIERS) > 0 ? 1 : 0; return { current: v, target: 1 }; }
    case 'ultraRareDup':   { const v = hasDuplicateUltra() ? 1 : 0; return { current: v, target: 1 }; }
    case 'secretRareFirst':{ const v = countByTiers(SECRET_TIERS) > 0 ? 1 : 0; return { current: v, target: 1 }; }

    // Economy
    case 'duplicatesSold10':  { const v = getDuplicatesSold(); return { current: v, target: 10 }; }
    case 'duplicatesSold50':  { const v = getDuplicatesSold(); return { current: v, target: 50 }; }
    case 'duplicatesSold200': { const v = getDuplicatesSold(); return { current: v, target: 200 }; }
    case 'requests5':         { const v = getRequestsCompleted(); return { current: v, target: 5 }; }
    case 'requests20':        { const v = getRequestsCompleted(); return { current: v, target: 20 }; }
    case 'requests50':        { const v = getRequestsCompleted(); return { current: v, target: 50 }; }
    case 'revenue500':        { const v = getLifetimeRevenue(); return { current: v, target: 500,  displayFn: p => `$${p.toFixed(0)}` }; }
    case 'revenue2000':       { const v = getLifetimeRevenue(); return { current: v, target: 2000, displayFn: p => `$${p.toFixed(0)}` }; }
    case 'revenue10000':      { const v = getLifetimeRevenue(); return { current: v, target: 10000,displayFn: p => `$${p.toFixed(0)}` }; }
    case 'brokerFirst':       { const v = getBrokerPurchases() > 0 ? 1 : 0; return { current: v, target: 1 }; }
    case 'broker5':           { const v = getBrokerPurchases(); return { current: v, target: 5 }; }
    case 'broker25':          { const v = getBrokerPurchases(); return { current: v, target: 25 }; }
    case 'distressRecovered': { const v = hasDistressRecovered() ? 1 : 0; return { current: v, target: 1 }; }

    // Reputation
    case 'rankCollector': { const v = getReputation(); return { current: v, target: 100 }; }
    case 'rankAdvanced':  { const v = getReputation(); return { current: v, target: 400 }; }
    case 'rankElite':     { const v = getReputation(); return { current: v, target: 1000 }; }
    case 'rankMaster':    { const v = getReputation(); return { current: v, target: 2500 }; }
    case 'rankCurator':   { const v = getReputation(); return { current: v, target: 5000 }; }
    case 'rankLegendary': { const v = getReputation(); return { current: v, target: 10000 }; }

    // Rare Hunter
    case 'holo10':      { const v = countByTiers(HOLO_TIERS); return { current: v, target: 10 }; }
    case 'holo25':      { const v = countByTiers(HOLO_TIERS); return { current: v, target: 25 }; }
    case 'holo50':      { const v = countByTiers(HOLO_TIERS); return { current: v, target: 50 }; }
    case 'ultraRare3':  { const v = countByTiers(ULTRA_TIERS); return { current: v, target: 3 }; }
    case 'secretFirst': { const v = countByTiers(SECRET_TIERS); return { current: v, target: 1 }; }
    case 'secrets3':    { const v = countByTiers(SECRET_TIERS); return { current: v, target: 3 }; }
    case 'secrets5':    { const v = countByTiers(SECRET_TIERS); return { current: v, target: 5 }; }
    case 'secretDup':   { const v = hasDuplicateSecret() ? 1 : 0; return { current: v, target: 1 }; }

    // Vendor Loyalty (v1.3.0)
    case 'pokemartFavor3': { const v = getFavorLevel('pokemart');     return { current: v, target: 3 }; }
    case 'pokemartFavor5': { const v = getFavorLevel('pokemart');     return { current: v, target: 5 }; }
    case 'retroFavor3':    { const v = getFavorLevel('retroVault');   return { current: v, target: 3 }; }
    case 'retroFavor5':    { const v = getFavorLevel('retroVault');   return { current: v, target: 5 }; }
    case 'nightFavor3':    { const v = getFavorLevel('nightMarket');  return { current: v, target: 3 }; }
    case 'nightFavor5':    { const v = getFavorLevel('nightMarket');  return { current: v, target: 5 }; }
    case 'brokerFavor3':   { const v = getFavorLevel('broker');       return { current: v, target: 3 }; }
    case 'brokerFavor5':   { const v = getFavorLevel('broker');       return { current: v, target: 5 }; }
    case 'allFavor2':      { const v = vendorsAtFavor(2); return { current: v, target: 4 }; }
    case 'allFavor3':      { const v = vendorsAtFavor(3); return { current: v, target: 4 }; }

    // Set Mastery (v1.3.0)
    case 'sets3Touched':   { const v = countSetsTouched(); return { current: v, target: 3 }; }
    case 'sets10Touched':  { const v = countSetsTouched(); return { current: v, target: 10 }; }
    case 'sets25Touched':  { const v = countSetsTouched(); return { current: v, target: 25 }; }
    case 'setsHalf2':      { const v = setCompletionsAtLeast(0.5); return { current: v, target: 2 }; }
    case 'setsHalf5':      { const v = setCompletionsAtLeast(0.5); return { current: v, target: 5 }; }
    case 'setsComplete2':  { const v = setCompletionsAtLeast(1.0); return { current: v, target: 2 }; }
    case 'setsComplete5':  { const v = setCompletionsAtLeast(1.0); return { current: v, target: 5 }; }
    case 'setsComplete10': { const v = setCompletionsAtLeast(1.0); return { current: v, target: 10 }; }

    // Discovery (v1.3.0)
    case 'rarity3':           { const v = countDistinctRarities(); return { current: v, target: 3 }; }
    case 'rarity6':           { const v = countDistinctRarities(); return { current: v, target: 6 }; }
    case 'rarityAll':         { const v = countDistinctRarities(); return { current: v, target: 9 }; }
    case 'doubleRare5':       { const v = countByTiers(DOUBLE_TIERS); return { current: v, target: 5 }; }
    case 'illustrationRare5': { const v = countByTiers(ILLO_TIERS);   return { current: v, target: 5 }; }
    case 'secrets10':         { const v = countByTiers(SECRET_TIERS); return { current: v, target: 10 }; }

    default: return { current: 0, target: 1 };
  }
}

// ─── Progressive revelation ───────────────────────────────────────────────────
// In each category, always show the first 3 milestones.
// After the last claimed milestone in the category, reveal one more.
// This means the player always has a visible "next goal" without the
// full list being spoiled.

function getRevealedMilestones(milestones, claimedSet) {
  let lastClaimedIdx = -1;
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (claimedSet.has(milestones[i].id)) { lastClaimedIdx = i; break; }
  }
  const revealUpTo = Math.max(3, lastClaimedIdx + 2);
  return milestones.map((m, i) => ({ ...m, revealed: i < revealUpTo }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full status for all categories, with progressive revelation.
 * Each category result: { id, label, icon, milestones: [...], completedCount, totalCount }
 * Each milestone: { ...m, current, target, progressPct, complete, claimed, claimable, revealed }
 */
export function getCategoryStatus() {
  _sweepCollection = _getCollection();
  try {
    const claimedSet = new Set(load().claimed);
    return CATEGORIES.map(cat => {
    const revealed = getRevealedMilestones(cat.milestones, claimedSet);
    const milestones = revealed.map(m => {
      const p    = progressFor(m.id);
      const pct  = Math.min(100, (p.current / Math.max(p.target, 0.0001)) * 100);
      const done = pct >= 100;
      return {
        ...m,
        current:     p.current,
        target:      p.target,
        displayFn:   p.displayFn,
        progressPct: pct,
        complete:    done,
        claimed:     claimedSet.has(m.id),
        claimable:   done && !claimedSet.has(m.id),
      };
    });
      const completedCount = milestones.filter(m => m.claimed).length;
      return { ...cat, milestones, completedCount, totalCount: cat.milestones.length };
    });
  } finally {
    _sweepCollection = null;
  }
}

/**
 * Flat milestone status — backward compat for milestoneManager consumers.
 * @deprecated Prefer getCategoryStatus() for UI display.
 */
export function getMilestoneStatus() {
  _sweepCollection = _getCollection();
  try {
    const claimedSet = new Set(load().claimed);
    return MILESTONES.map(m => {
    const p   = progressFor(m.id);
    const pct = Math.min(100, (p.current / Math.max(p.target, 0.0001)) * 100);
    const done = pct >= 100;
    return {
      ...m,
      current: p.current, target: p.target,
      progressPct: pct, complete: done,
        claimed: claimedSet.has(m.id), claimable: done && !claimedSet.has(m.id),
      };
    });
  } finally {
    _sweepCollection = null;
  }
}

/**
 * Sweep all milestones and auto-claim any that are newly complete.
 * Returns claimed milestones with their full reward bag for the caller
 * to apply. v1.4.0 introduced diversified reward types — any new fields
 * on a milestone are passed straight through; legacy milestones with
 * only rewardCash/rewardRep continue to work unchanged.
 *
 * Reward shape (all optional):
 *   rewardCash      number          — small cash payout
 *   rewardRep       number          — reputation grant
 *   rewardNote      string          — appended to toast as flavor
 *   rewardFavor     { vendorId, amount }  — favor boost on a vendor
 *   rewardPrestige  number          — collection prestige bonus points
 *   rewardDiscount  { vendorId, pct, durationMs } — temporary pack discount
 *   rewardArchive   string          — atmospheric archive history label
 */
export function getReadyMilestoneRewards() {
  const status  = getMilestoneStatus();
  const claimed = [];
  for (const m of status) {
    if (m.claimable) {
      claimed.push({
        id:             m.id,
        title:          m.title,
        rewardCash:     m.rewardCash || 0,
        rewardRep:      m.rewardRep  || 0,
        rewardNote:     m.rewardNote,
        rewardFavor:    m.rewardFavor    || null,
        rewardPrestige: m.rewardPrestige || 0,
        rewardDiscount: m.rewardDiscount || null,
        rewardArchive:  m.rewardArchive  || null,
      });
    }
  }
  return claimed;
}

/** v1.4.0 — read-only list of all claimed milestone IDs. */
export function markMilestonesClaimed(ids) {
  const s = load();
  const set = new Set(s.claimed);
  for (const id of ids || []) {
    if (id) set.add(id);
  }
  s.claimed = [...set];
  save(s);
  return s.claimed;
}

export function autoClaimReadyMilestones() {
  const claimed = getReadyMilestoneRewards();
  if (claimed.length > 0) markMilestonesClaimed(claimed.map(m => m.id));
  return claimed;
}

export function getClaimedMilestones() {
  return load().claimed.slice();
}

export function clearMilestones() { localStorage.removeItem(STORAGE_KEY); }
