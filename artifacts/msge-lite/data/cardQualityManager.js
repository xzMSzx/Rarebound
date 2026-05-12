/**
 * data/cardQualityManager.js — v1.5.0 (extended from v1.4.0)
 *
 * Hidden card-quality metadata that backs the AGS grading system.
 *
 * v1.5.0 — per-copy quality. Each physical copy a player owns has its own
 * unique quality fingerprint. Copy 1's quality is back-compatible with the
 * v1.4.0 per-design record (if present, that record is adopted as copy 1).
 *
 * Eligibility: doubleRare+ only. Commons/uncommons/rares/holos never get
 * quality — keeps the AGS economy from drowning in trivial grades.
 *
 * Determinism: each copy's quality is generated from a stable seed
 * `${setId}:${cardId}:c${copyN}` so:
 *   - re-rendering the same copy never changes its quality
 *   - retroactive lazy-init on legacy saves produces stable values
 *
 * Storage:
 *   tcg_card_quality     — v1.4.0 per-design records (read-only fallback)
 *   tcg_card_quality_v2  — v1.5.0 per-copy records, keyed `setId:cardId:c{N}`
 */

import { isPlainObject, readJson, writeJson } from './persistenceStore.js';

const STORAGE_KEY_V1 = 'tcg_card_quality';
const STORAGE_KEY_V2 = 'tcg_card_quality_v2';

const ELIGIBLE_RARITIES = new Set([
  'doubleRare',
  'ultraRare',
  'illustrationRare',
  'specialIllustrationRare',
  'hyperRare',
]);

function loadV1() {
  return readJson(STORAGE_KEY_V1, {}, isPlainObject).value;
}
function loadV2() {
  return readJson(STORAGE_KEY_V2, {}, isPlainObject).value;
}
function saveV2(store) {
  try { writeJson(STORAGE_KEY_V2, store); }
  catch {}
}

/** Stable string→uint32 hash (FNV-1a). Same inputs → same output. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic mulberry32 PRNG seeded by the card key. */
function seededRng(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Subgrade roll. Realistic distribution:
 *   ~70% land in 70..89 (common play / NM)
 *   ~22% land in 90..94 (Mint)
 *   ~6%  land in 95..97 (Gem Mint)
 *   ~1.5% land in 98..99 (Pristine)
 *   <0.5% land at 100 (perfect)
 *
 * Triangular base + heavy easing pushes mass toward middle while keeping
 * long tail very thin — this is what makes AGS 10 feel rare.
 */
function rollAttribute(rng) {
  const a = rng();
  const b = rng();
  const c = rng();
  // Triangular peak; one extra sample reduces variance vs v1.4.0
  const tri    = (a + b + c) / 3;
  const eased  = Math.pow(tri, 0.65);
  let v = 50 + eased * 50; // 50..100 base
  // Compress upper tail: very few cards reach 95+
  if (v > 90) {
    const over = v - 90;
    v = 90 + Math.pow(over / 10, 1.6) * 10;
  }
  return Math.round(Math.max(50, Math.min(100, v)));
}

export function isEligibleRarity(rarity) {
  return ELIGIBLE_RARITIES.has(rarity);
}

/**
 * Build the v2 storage key for a specific copy.
 * @param {string} setId @param {string} cardId @param {number} copyN — 1-indexed.
 */
export function copyKey(setId, cardId, copyN) {
  return `${setId}:${cardId}:c${Math.max(1, copyN | 0)}`;
}

/**
 * Generate (and persist) hidden quality for an eligible card copy if absent.
 * Idempotent. If copyN===1 and a v1.4.0 record exists at the per-design key,
 * that record is adopted (with copyN added) — preserves legacy determinism.
 *
 * @param {string} setId
 * @param {string} cardId
 * @param {number} copyN — 1-indexed copy number
 * @param {string} rarity — rarityType string
 * @param {object} [opts] — { retroactive?: boolean, sourceVendor?: string }
 * @returns {object|null} — record, or null if rarity ineligible
 */
export function ensureQualityForCopy(setId, cardId, copyN, rarity, opts = {}) {
  if (!setId || !cardId) return null;
  if (!ELIGIBLE_RARITIES.has(rarity)) return null;
  const cN = Math.max(1, copyN | 0);
  const key   = copyKey(setId, cardId, cN);
  const store = loadV2();
  if (store[key]) return store[key];

  // v1.4.0 → v1.5.0 lazy migration: copy 1 inherits the per-design record
  if (cN === 1) {
    const legacy = loadV1()[`${setId}:${cardId}`];
    if (legacy) {
      const adopted = { ...legacy, copyN: 1, uid: key };
      if (!adopted.pulledAt) adopted.pulledAt = Date.now();
      adopted.sourceVendor = adopted.sourceVendor || opts.sourceVendor || null;
      store[key] = adopted;
      saveV2(store);
      return adopted;
    }
  }

  const seed = fnv1a(key);
  const rng  = seededRng(seed);
  const record = {
    uid: key,
    copyN: cN,
    setId, cardId, rarity,
    centering:    rollAttribute(rng),
    surface:      rollAttribute(rng),
    edges:        rollAttribute(rng),
    corners:      rollAttribute(rng),
    printQuality: rollAttribute(rng),
    hiddenGradeSeed: Math.round(rng() * 1e6) / 1e6,
    pulledAt: Date.now(),
    sourceVendor: opts.sourceVendor || null,
    retroactive: !!opts.retroactive,
  };
  store[key] = record;
  saveV2(store);
  return record;
}

/**
 * v1.4.0-compatible entry point. Always operates on copy 1 — preserves the
 * old per-design semantics for callers that haven't been updated yet.
 */
export function ensureQualityForCard(setId, cardId, rarity, retroactive = false) {
  return ensureQualityForCopy(setId, cardId, 1, rarity, { retroactive });
}

/** Read-only — returns the per-copy record or null. */
export function getQualityRecord(setId, cardId, copyN = 1) {
  if (!setId || !cardId) return null;
  return loadV2()[copyKey(setId, cardId, copyN)] || null;
}

/**
 * Convenience: ensure-then-return for a specific copy. Will lazily generate
 * the record if absent (used by Archive Services UI on first viewing).
 */
export function getOrCreateQuality(setId, cardId, copyN, rarity) {
  if (!ELIGIBLE_RARITIES.has(rarity)) return null;
  const existing = getQualityRecord(setId, cardId, copyN);
  if (existing) return existing;
  return ensureQualityForCopy(setId, cardId, copyN, rarity, { retroactive: true });
}

/** All eligible copies the player owns, derived from collection counts. */
export function listAllOwnedQuality(getCollectionFn, mapRarityFn, getCachedSetCardsFn) {
  const out = [];
  const collection = getCollectionFn();
  for (const [setId, cards] of Object.entries(collection)) {
    const cached = getCachedSetCardsFn(setId) || [];
    const byId   = Object.fromEntries(cached.map(c => [c.id, c]));
    for (const [cardId, entry] of Object.entries(cards)) {
      const apiCard = byId[cardId];
      if (!apiCard) continue;
      const tier = mapRarityFn(apiCard.rarity);
      if (!ELIGIBLE_RARITIES.has(tier)) continue;
      const count = entry.count || 0;
      for (let cN = 1; cN <= count; cN++) {
        const rec = getOrCreateQuality(setId, cardId, cN, tier);
        if (rec) out.push({ ...rec, _apiCard: apiCard });
      }
    }
  }
  return out;
}

/** Diagnostics only. */
export function getQualityCount() {
  return Object.keys(loadV2()).length;
}

export function clearAllQuality() {
  localStorage.removeItem(STORAGE_KEY_V1);
  localStorage.removeItem(STORAGE_KEY_V2);
}
