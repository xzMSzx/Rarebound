/**
 * data/agsSubmissionManager.js — v1.5.0
 *
 * AGS — Archive Grading Services. Submission lifecycle:
 *
 *     [eligible raw copy]
 *       ↓ submit(setId, cardId, copyN, tier)
 *     [active submission, locked]  ← rotates 5 status labels
 *       ↓ tick() detects returnAt <= now()
 *     [graded, registered]         ← lives in registry forever
 *
 * Storage:
 *   tcg_ags_submissions = {
 *     active:    Submission[],
 *     completed: GradedSlab[],
 *     nextSerial: number,        // running serial counter for cert numbers
 *   }
 *
 * Submission       = { uid, setId, cardId, copyN, tier, submittedAt, returnAt }
 * GradedSlab       = { uid, setId, cardId, copyN, tier, submittedAt, gradedAt,
 *                      grade, prestigeSlab, serial }
 *   - uid: cardQualityManager copyKey, e.g. "set:card:c2"
 *   - prestigeSlab: true iff tier === 'prestige' (premium slab variant)
 *   - serial: zero-padded "AGS-000123"
 *   - grade: full output of summarizeGrade()
 *
 * IMPORTANT — economy safety constraints (per spec):
 *   - submissions are slow + expensive
 *   - perfect grades remain ultra-rare (the engine handles this)
 *   - submissions LOCK the underlying copy so it cannot be sold/used
 *     elsewhere (gating handled at sell-flow callsite via lockedCopiesFor)
 */

import { copyKey, getOrCreateQuality } from './cardQualityManager.js';
import { summarizeGrade } from './agsGradingEngine.js';

const STORAGE_KEY = 'tcg_ags_submissions';

/** Tier definitions — turnaround in milliseconds. */
export const SUBMISSION_TIERS = {
  standard: {
    id: 'standard',
    label: 'Standard Review',
    blurb: 'Reliable archival assessment.',
    cost: 40,
    durationMs: 6 * 60 * 60 * 1000,
    durationLabel: '6 hour turnaround',
    prestigeSlab: false,
  },
  priority: {
    id: 'priority',
    label: 'Priority Review',
    blurb: 'Expedited review by senior archivists.',
    cost: 90,
    durationMs: 1 * 60 * 60 * 1000,
    durationLabel: '1 hour turnaround',
    prestigeSlab: false,
  },
  prestige: {
    id: 'prestige',
    label: 'Prestige Archive',
    blurb: 'Premium slab variant. Cinematic certification ceremony.',
    cost: 200,
    durationMs: 30 * 60 * 1000,
    durationLabel: '30 minute turnaround',
    prestigeSlab: true,
  },
};

/** Rotating review-status labels surfaced in the active-submission tile. */
export const REVIEW_STATUSES = [
  'Preparing Archive Evaluation',
  'Surface Scanning',
  'Authenticity Validation',
  'Precision Alignment Check',
  'Final Archive Certification',
];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== 'object') {
      return { active: [], completed: [], nextSerial: 1001 };
    }
    return {
      active:    Array.isArray(raw.active)    ? raw.active    : [],
      completed: Array.isArray(raw.completed) ? raw.completed : [],
      nextSerial: Number.isFinite(raw.nextSerial) ? raw.nextSerial : 1001,
    };
  } catch {
    return { active: [], completed: [], nextSerial: 1001 };
  }
}
function save(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function formatSerial(n) {
  return `AGS-${String(n).padStart(6, '0')}`;
}

/** Total number of "currently busy" copies for a card (active + completed). */
export function lockedCopiesFor(setId, cardId) {
  const s = load();
  let n = 0;
  for (const a of s.active)    if (a.setId === setId && a.cardId === cardId) n++;
  for (const g of s.completed) if (g.setId === setId && g.cardId === cardId) n++;
  return n;
}

/** Specific-copy lock check. */
export function isCopyLocked(setId, cardId, copyN) {
  const uid = copyKey(setId, cardId, copyN);
  const s = load();
  if (s.active.some(a => a.uid === uid)) return true;
  if (s.completed.some(g => g.uid === uid)) return true;
  return false;
}

/**
 * Find the lowest copyN of (setId, cardId) that is NOT currently submitted
 * or graded — i.e. the next eligible raw copy the player may submit.
 * @returns {number|null}
 */
export function nextSubmittableCopyN(setId, cardId, ownedCount) {
  if (!ownedCount || ownedCount <= 0) return null;
  for (let cN = 1; cN <= ownedCount; cN++) {
    if (!isCopyLocked(setId, cardId, cN)) return cN;
  }
  return null;
}

/**
 * Begin a submission. Caller is responsible for charging the player and
 * ensuring rarity eligibility — this function only manages the state.
 *
 * @returns {Submission|null} — null if a copy isn't available
 */
export function submitForGrading({ setId, cardId, copyN, tier, rarity }) {
  const tierDef = SUBMISSION_TIERS[tier];
  if (!tierDef) return null;
  if (!setId || !cardId || !copyN) return null;
  if (isCopyLocked(setId, cardId, copyN)) return null;

  // Make absolutely sure the hidden quality record exists before we lock it
  // for review. Lazy generation here keeps legacy save migration painless.
  getOrCreateQuality(setId, cardId, copyN, rarity);

  const now = Date.now();
  const sub = {
    uid: copyKey(setId, cardId, copyN),
    setId, cardId, copyN,
    tier: tierDef.id,
    submittedAt: now,
    returnAt:    now + tierDef.durationMs,
  };
  const store = load();
  store.active.push(sub);
  if (!save(store)) return null;
  return sub;
}

/** Active submissions, optionally sorted by closest-return first. */
export function getActiveSubmissions() {
  return load().active.slice().sort((a, b) => a.returnAt - b.returnAt);
}

/** All graded slabs the player owns. */
export function getCompletedSlabs() {
  return load().completed.slice();
}

/** Look up a graded slab by uid (copyKey). */
export function getSlabByUid(uid) {
  return load().completed.find(g => g.uid === uid) || null;
}

/** Time-progress for an active submission, 0..1. */
export function progressFor(sub) {
  if (!sub) return 0;
  const total = Math.max(1, sub.returnAt - sub.submittedAt);
  const done  = Math.min(total, Math.max(0, Date.now() - sub.submittedAt));
  return done / total;
}

/** Currently displayed status label for an active submission. */
export function statusLabelFor(sub) {
  const p = progressFor(sub);
  const idx = Math.min(REVIEW_STATUSES.length - 1,
                       Math.floor(p * REVIEW_STATUSES.length));
  return REVIEW_STATUSES[idx];
}

/** Friendly mm:ss / h:mm "remaining" string. */
export function timeRemainingLabel(sub) {
  const ms = Math.max(0, sub.returnAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * Tick the submission queue. Promotes any active submission whose
 * `returnAt <= now()` into the completed queue (computing the grade once).
 *
 * @returns {GradedSlab[]} — slabs newly completed by this tick (for UI fanfare)
 */
export function tickSubmissions() {
  const store = load();
  const now = Date.now();
  const stillActive = [];
  const newlyCompleted = [];
  let serial = store.nextSerial;

  for (const sub of store.active) {
    if (sub.returnAt > now) { stillActive.push(sub); continue; }

    // Resolve the hidden quality record (lazy-generate as final safety net)
    const quality = getOrCreateQuality(sub.setId, sub.cardId, sub.copyN, sub.rarity || 'doubleRare');
    const grade   = summarizeGrade(quality);

    const slab = {
      uid: sub.uid,
      setId: sub.setId, cardId: sub.cardId, copyN: sub.copyN,
      tier: sub.tier,
      submittedAt: sub.submittedAt,
      gradedAt: now,
      grade,
      prestigeSlab: !!SUBMISSION_TIERS[sub.tier]?.prestigeSlab,
      serial: formatSerial(serial++),
    };
    store.completed.push(slab);
    newlyCompleted.push(slab);
  }

  if (newlyCompleted.length === 0) return [];

  store.active     = stillActive;
  store.nextSerial = serial;
  if (!save(store)) return [];
  return newlyCompleted;
}

/**
 * v1.6.0 — Return all graded slabs for a card (across all owned copies).
 * Pure read; safe with empty registry.
 */
export function getSlabsForCard(setId, cardId) {
  if (!setId || !cardId) return [];
  return load().completed.filter(g => g.setId === setId && g.cardId === cardId);
}

/**
 * v1.6.0 — Return the highest-grade slab for a card, or null. Used by
 * binder badges + card-detail "archived copy available" link.
 */
export function getHighestSlabForCard(setId, cardId) {
  const slabs = getSlabsForCard(setId, cardId);
  if (!slabs.length) return null;
  let best = slabs[0];
  for (const s of slabs) {
    if ((s.grade?.tier?.rank || 0) > (best.grade?.tier?.rank || 0)) best = s;
  }
  return best;
}

/** Aggregate stats surfaced in the AGS hero panel + activity feed. */
export function getAgsStats() {
  const s = load();
  let highest = null;
  let totalArchiveValue = 0;
  for (const slab of s.completed) {
    if (!highest || slab.grade.tier.rank > highest.grade.tier.rank) highest = slab;
  }
  return {
    active:     s.active.length,
    archived:   s.completed.length,
    highestSlab: highest,
    nextSerial: s.nextSerial,
  };
}

/** Diagnostics / dev reset only. */
export function clearAllSubmissions() {
  localStorage.removeItem(STORAGE_KEY);
}
