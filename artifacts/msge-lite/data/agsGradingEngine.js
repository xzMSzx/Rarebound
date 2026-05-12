/**
 * data/agsGradingEngine.js — v1.5.0
 *
 * Pure (no I/O) grading logic for the AGS Archive Grading Services system.
 *
 * Inputs:  a hidden quality record from cardQualityManager + a submission tier.
 * Outputs: a grade tier (AGS 6..10 or BLACK_LABEL), the displayed numeric grade,
 *          tier-band metadata used by the UI, and a final value multiplier
 *          that the player will see applied at sale time.
 *
 * Determinism: grading is purely a function of the copy's hidden quality and
 * a small seeded variance (`hiddenGradeSeed`). Submission tier does NOT shift
 * the grade — only the experience around it (turnaround, presentation, prestige).
 * The "review" UI never reveals subgrades until the reveal moment.
 *
 * AGS tiers (anchored to weighted-average subgrade):
 *   BLACK_LABEL — all 5 subgrades >= 95 AND avg >= 96.5  (ultra-rare prestige)
 *   AGS 10      — avg >= 92                              (Archive Pristine)
 *   AGS 9.5     — avg >= 88                              (Pristine)
 *   AGS 9       — avg >= 82                              (Gem Mint)
 *   AGS 8       — avg >= 72                              (Mint)
 *   AGS 7       — avg >= 60                              (Near Mint)
 *   AGS 6       — < 60                                   (Played)
 *
 * Multipliers (anchored to spec, slight in-band variance from hiddenGradeSeed):
 *   AGS 6:        0.85x  — 0.95x   (played slabs sit below raw)
 *   AGS 7:        1.05x  — 1.15x
 *   AGS 8:        1.20x  — 1.40x
 *   AGS 9:        1.60x  — 2.00x
 *   AGS 9.5:      2.50x  — 4.00x
 *   AGS 10:       5.00x  — 10.00x
 *   BLACK_LABEL:  12.00x — 25.00x
 */

const SUBGRADE_WEIGHTS = {
  centering:    0.28,
  surface:      0.24,
  corners:      0.18,
  edges:        0.18,
  printQuality: 0.12,
};

export const AGS_TIERS = {
  BLACK_LABEL: { id: 'BLACK_LABEL', label: 'AGS BLACK',     numeric: 'BL',  rank: 7 },
  AGS_10:      { id: 'AGS_10',      label: 'AGS 10',        numeric: 10,    rank: 6 },
  AGS_9_5:     { id: 'AGS_9_5',     label: 'AGS 9.5',       numeric: 9.5,   rank: 5 },
  AGS_9:       { id: 'AGS_9',       label: 'AGS 9',         numeric: 9,     rank: 4 },
  AGS_8:       { id: 'AGS_8',       label: 'AGS 8',         numeric: 8,     rank: 3 },
  AGS_7:       { id: 'AGS_7',       label: 'AGS 7',         numeric: 7,     rank: 2 },
  AGS_6:       { id: 'AGS_6',       label: 'AGS 6',         numeric: 6,     rank: 1 },
};

const TIER_NAMES = {
  BLACK_LABEL: 'Black Label',
  AGS_10:      'Archive Pristine',
  AGS_9_5:     'Pristine',
  AGS_9:       'Gem Mint',
  AGS_8:       'Mint',
  AGS_7:       'Near Mint',
  AGS_6:       'Played',
};

const MULTIPLIER_BANDS = {
  BLACK_LABEL: [12.0, 25.0],
  AGS_10:      [5.0, 10.0],
  AGS_9_5:     [2.5, 4.0],
  AGS_9:       [1.6, 2.0],
  AGS_8:       [1.2, 1.4],
  AGS_7:       [1.05, 1.15],
  AGS_6:       [0.85, 0.95],
};

/** Weighted-average subgrade (0..100). */
export function weightedAverage(quality) {
  if (!quality) return 0;
  let sum = 0, total = 0;
  for (const [k, w] of Object.entries(SUBGRADE_WEIGHTS)) {
    const v = Number(quality[k]) || 0;
    sum   += v * w;
    total += w;
  }
  return total > 0 ? sum / total : 0;
}

/**
 * Determine the grade tier for a hidden quality record.
 * Pure function — same input always produces the same tier.
 */
export function calculateGradeTier(quality) {
  if (!quality) return AGS_TIERS.AGS_6;
  const c = Number(quality.centering)    || 0;
  const s = Number(quality.surface)      || 0;
  const e = Number(quality.edges)        || 0;
  const k = Number(quality.corners)      || 0;
  const p = Number(quality.printQuality) || 0;
  const avg = weightedAverage(quality);

  // BLACK LABEL — every subgrade must clear 95 and weighted avg must be 96.5+
  if (c >= 95 && s >= 95 && e >= 95 && k >= 95 && p >= 95 && avg >= 96.5) {
    return AGS_TIERS.BLACK_LABEL;
  }
  if (avg >= 92) return AGS_TIERS.AGS_10;
  if (avg >= 88) return AGS_TIERS.AGS_9_5;
  if (avg >= 82) return AGS_TIERS.AGS_9;
  if (avg >= 72) return AGS_TIERS.AGS_8;
  if (avg >= 60) return AGS_TIERS.AGS_7;
  return AGS_TIERS.AGS_6;
}

/** Final value multiplier for a given grade, varied by hiddenGradeSeed. */
export function multiplierForTier(tierId, hiddenGradeSeed = 0.5) {
  const band = MULTIPLIER_BANDS[tierId] || MULTIPLIER_BANDS.AGS_6;
  const t    = Math.max(0, Math.min(1, Number(hiddenGradeSeed) || 0));
  return band[0] + (band[1] - band[0]) * t;
}

/** Display name like "Archive Pristine". */
export function tierLabel(tierId) {
  return TIER_NAMES[tierId] || 'Unknown';
}

/**
 * Full grade summary used by the reveal sequence + slab UI + registry.
 * @param {object} quality - hidden quality record
 * @returns {{tier, label, name, numeric, multiplier, subgrades, average}}
 */
export function summarizeGrade(quality) {
  const tier = calculateGradeTier(quality);
  const avg  = weightedAverage(quality);
  const mult = multiplierForTier(tier.id, quality?.hiddenGradeSeed);
  return {
    tier,
    label: tier.label,
    name: tierLabel(tier.id),
    numeric: tier.numeric,
    multiplier: mult,
    subgrades: {
      centering:    quality?.centering    || 0,
      surface:      quality?.surface      || 0,
      edges:        quality?.edges        || 0,
      corners:      quality?.corners      || 0,
      printQuality: quality?.printQuality || 0,
    },
    average: Math.round(avg * 10) / 10,
  };
}

/**
 * "Atmospheric hint" line shown on the submission modal — never reveals the
 * grade. Picked deterministically from hiddenGradeSeed so the same card
 * always shows the same flavor line.
 *
 * Hints lean toward the actual quality but never confirm it.
 */
const HINTS_HIGH = [
  'Centering alignment within elite thresholds.',
  'Surface quality appears promising.',
  'Rare preservation candidate identified.',
  'Potential archive-tier candidate detected.',
  'Print register tracking exceeds nominal range.',
];
const HINTS_MID = [
  'Standard preservation profile detected.',
  'Surface integrity within typical range.',
  'Collector interest currently elevated.',
  'Edge condition consistent with set average.',
];
const HINTS_LOW = [
  'Surface review may identify minor irregularities.',
  'Standard handling indicators present.',
  'Edge inspection flagged for closer review.',
];

export function atmosphericHint(quality) {
  if (!quality) return HINTS_MID[0];
  const avg = weightedAverage(quality);
  const seed = Math.max(0, Math.min(1, Number(quality.hiddenGradeSeed) || 0));
  const pool = avg >= 86 ? HINTS_HIGH : avg >= 70 ? HINTS_MID : HINTS_LOW;
  return pool[Math.floor(seed * pool.length) % pool.length];
}
