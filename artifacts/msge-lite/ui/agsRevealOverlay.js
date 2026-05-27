/**
 * ui/agsRevealOverlay.js — v1.5.0
 *
 * AGS RETURN SEQUENCE — the cinematic certification reveal.
 *
 * Sequence (per spec):
 *   1. darkened screen
 *   2. slab silhouette
 *   3. AGS verification text
 *   4. subgrades appear one-by-one
 *   5. final grade reveal
 *   6. dramatic pause
 *   7. value impact line
 *
 * Reduced-motion users get a fade-only collapsed sequence.
 *
 * The overlay is fully self-contained — it appends a fixed-position root
 * to <body>, wires its own dismissal, and removes itself when finished.
 */

import { tierLabel } from '../data/agsGradingEngine.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';
import { onEscapeKey } from './overlayScrollLock.js';

const SUBGRADE_ORDER = [
  ['centering',    'Centering'],
  ['surface',      'Surface'],
  ['edges',        'Edges'],
  ['corners',      'Corners'],
  ['printQuality', 'Print Quality'],
];

/**
 * Show the reveal sequence for a freshly graded slab.
 *
 * @param {object} slab    — completed slab from agsSubmissionManager
 * @param {object} apiCard — pokemontcg.io card object
 * @param {object} [opts]
 * @param {() => void} [opts.onClose]
 * @param {boolean}    [opts.reducedMotion]
 */
export function showAgsRevealOverlay(slab, apiCard, opts = {}) {
  if (!slab?.grade?.tier) {
    console.error('[AGS] reveal aborted — invalid slab', slab);
    opts.onClose?.();
    return;
  }
  const tierId    = slab.grade.tier.id;
  const numeric   = slab.grade.numeric;
  const label     = slab.grade.label;
  const tierName  = slab.grade.name || tierLabel(tierId);
  const subgrades = slab.grade.subgrades || {};
  const reduced   = !!opts.reducedMotion;
  const mult      = slab.grade.multiplier || 1;
  const imgUrl    = apiCard?.images?.large || apiCard?.images?.small || '';
  const cardName  = apiCard?.name || 'Card';

  const root = document.createElement('div');
  root.className = `ags-reveal-overlay ags-reveal-tier-${tierId.toLowerCase()}`;
  if (slab.prestigeSlab) root.classList.add('ags-reveal--prestige');
  if (reduced)           root.classList.add('ags-reveal--reduced');

  const subRows = SUBGRADE_ORDER.map(([key, lbl]) => `
    <div class="ags-reveal__sub" data-sub="${key}">
      <span class="ags-reveal__sub-key">${lbl}</span>
      <span class="ags-reveal__sub-val" data-target="${(subgrades[key] || 0).toFixed(0)}">—</span>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="ags-reveal__backdrop"></div>
    <div class="ags-reveal__stage">
      <div class="ags-reveal__eyebrow">Archive Grading Services</div>
      <div class="ags-reveal__cert">${slab.serial || ''}</div>

      <div class="ags-reveal__art-wrap">
        <div class="ags-reveal__silhouette">
          ${imgUrl
            ? `<img class="ags-reveal__art" src="${imgUrl}" alt="${cardName}" loading="eager" decoding="async" />`
            : `<div class="ags-reveal__art ags-reveal__art--missing">${cardName}</div>`
          }
        </div>
        <div class="ags-reveal__card-name">${cardName}</div>
      </div>

      <div class="ags-reveal__subgrades">${subRows}</div>

      <div class="ags-reveal__final-wrap">
        <div class="ags-reveal__final-label">Final Certification</div>
        <div class="ags-reveal__final-grade">
          <span class="ags-reveal__final-tier">${label}</span>
          <span class="ags-reveal__final-name">${tierName}</span>
        </div>
        <div class="ags-reveal__multiplier">Archive multiplier · ${mult.toFixed(2)}×</div>
      </div>

      <button class="ags-reveal__close" type="button">Continue</button>
    </div>
  `;
  document.body.appendChild(root);
  lockBodyScroll();

  let closed = false;
  /** @type {() => void} */
  let disposeEscape = () => {};

  const close = () => {
    if (closed) return;
    closed = true;
    disposeEscape();
    unlockBodyScroll();
    root.classList.add('is-closing');
    setTimeout(() => {
      root.remove();
      opts.onClose?.();
    }, 240);
  };

  // Wire close on button + backdrop click
  const closeBtn = root.querySelector('.ags-reveal__close');
  closeBtn?.addEventListener('click', close);
  root.querySelector('.ags-reveal__backdrop')?.addEventListener('click', close);

  disposeEscape = onEscapeKey((e) => {
    e.preventDefault();
    close();
  });

  // Drive the cinematic sequence on rAF / setTimeout — no library needed.
  const stages = [
    { delay: 60,   classes: ['stage-backdrop'] },
    { delay: 540,  classes: ['stage-silhouette'] },
    { delay: 980,  classes: ['stage-cert'] },
    { delay: 1480, classes: ['stage-subgrades'], action: revealSubgradesSequentially },
    { delay: 3520, classes: ['stage-final'] },
    { delay: 4400, classes: ['stage-multiplier'] },
    { delay: 5000, classes: ['stage-cta'] },
  ];

  // Reduced-motion: collapse all stages into a single fade
  if (reduced) {
    stages.forEach(s => root.classList.add(...s.classes));
    revealSubgradesSequentially(true);
    return { close };
  }

  for (const s of stages) {
    setTimeout(() => {
      if (closed) return;
      root.classList.add(...s.classes);
      s.action?.(false);
    }, s.delay);
  }

  function revealSubgradesSequentially(instant) {
    const rows = root.querySelectorAll('.ags-reveal__sub');
    rows.forEach((row, i) => {
      const valEl = row.querySelector('.ags-reveal__sub-val');
      const target = Number(valEl?.dataset?.target || 0);
      const reveal = () => {
        row.classList.add('is-visible');
        if (valEl) valEl.textContent = (target / 10).toFixed(1);
      };
      if (instant) reveal();
      else setTimeout(reveal, i * 360);
    });
  }

  return { close };
}
