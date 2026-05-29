/**
 * ui/slabRenderer.js — v1.5.0
 *
 * Pure-DOM slab renderer. Returns an HTMLElement that visually wraps a
 * card image in a graded-slab presentation (header plate, grade badge,
 * subgrade strip, certification serial, prestige accents).
 *
 * Designed to be CHEAP to render so it can appear in lists / grids
 * without crippling mobile Safari. All visuals are CSS — no canvas, no
 * SVG filters, no per-frame animation by default.
 *
 * Usage:
 *   const el = renderSlab(slab, { variant: 'compact' });
 *   container.appendChild(el);
 */

import { tierLabel } from '../data/agsGradingEngine.js';
import { SUBMISSION_TIERS } from '../data/agsSubmissionManager.js';

/**
 * @param {object} slab    — GradedSlab from agsSubmissionManager
 * @param {object} apiCard — pokemontcg.io card object (for image + name)
 * @param {object} [opts]
 * @param {'compact'|'full'} [opts.variant='compact']
 * @param {boolean} [opts.showSerial=true]
 * @param {boolean} [opts.showSubgrades=false]   — full reveal mode
 * @returns {HTMLElement}
 */
export function renderSlab(slab, apiCard, opts = {}) {
  const variant       = opts.variant || 'compact';
  const showSerial    = opts.showSerial !== false;
  const showSubgrades = !!opts.showSubgrades;

  const tierId  = slab?.grade?.tier?.id || 'AGS_6';
  const numeric = slab?.grade?.numeric ?? '?';
  const label   = slab?.grade?.label   || 'AGS ?';
  const name    = slab?.grade?.name    || tierLabel(tierId);

  const slabEl = document.createElement('div');
  slabEl.className =
    `ags-slab ags-slab--${variant} ags-tier-${tierId.toLowerCase()}`
    + (slab?.prestigeSlab ? ' ags-slab--prestige' : '');
  slabEl.dataset.slabUid = slab?.uid || '';

  const imgUrl =
    apiCard?.images?.large ||
    apiCard?.images?.small ||
    '';

  const subgradesHTML = showSubgrades && slab?.grade?.subgrades ? `
    <div class="ags-slab__subgrades">
      ${renderSubBar('CEN', slab.grade.subgrades.centering)}
      ${renderSubBar('SUR', slab.grade.subgrades.surface)}
      ${renderSubBar('EDG', slab.grade.subgrades.edges)}
      ${renderSubBar('COR', slab.grade.subgrades.corners)}
      ${renderSubBar('PRT', slab.grade.subgrades.printQuality)}
    </div>
  ` : '';

  slabEl.innerHTML = `
    <div class="ags-slab__shell">
      <div class="ags-slab__header">
        <span class="ags-slab__brand">AGS</span>
        <span class="ags-slab__tier-name">${name}</span>
      </div>
      <div class="ags-slab__window">
        <div class="ags-slab__sheen" aria-hidden="true"></div>
        ${imgUrl
          ? `<img class="ags-slab__art" src="${imgUrl}" alt="${apiCard?.name || 'card'}" loading="lazy" decoding="async" />`
          : `<div class="ags-slab__art ags-slab__art--missing">${apiCard?.name || 'card'}</div>`
        }
        <div class="ags-slab__badge">
          <span class="ags-slab__badge-num">${numeric}</span>
        </div>
      </div>
      ${subgradesHTML}
      ${showSerial ? `
        <div class="ags-slab__footer">
          <span class="ags-slab__cert">${slab?.serial || ''}</span>
          <span class="ags-slab__label">${label}</span>
        </div>
      ` : ''}
    </div>
  `;
  return slabEl;
}

function renderSubBar(label, value) {
  const v   = Math.max(0, Math.min(100, Number(value) || 0));
  const pct = v.toFixed(0);
  return `
    <div class="ags-slab__subrow">
      <span class="ags-slab__subkey">${label}</span>
      <span class="ags-slab__subval">${(v / 10).toFixed(1)}</span>
      <span class="ags-slab__subbar"><span style="width:${pct}%"></span></span>
    </div>
  `;
}

/**
 * Pure HTML string version (faster for large lists where you don't need
 * a real Element back). Same options as renderSlab.
 */
export function slabHTML(slab, apiCard, opts = {}) {
  const wrapper = document.createElement('div');
  wrapper.appendChild(renderSlab(slab, apiCard, opts));
  return wrapper.innerHTML;
}

/* ═══════════════════════════════════════════════════════════════════
 * v1.5.2 — Premium Slab (full-screen viewer only)
 *
 * Museum-grade nested-shell slab. Used exclusively by openSlabViewer().
 * The compact tile (renderSlab above) is kept untouched for list perf.
 * ═══════════════════════════════════════════════════════════════════ */

const TIER_CLASS_MAP = {
  AGS_6:       'premium-slab--tier-6',
  AGS_7:       'premium-slab--tier-7',
  AGS_8:       'premium-slab--tier-8',
  AGS_9:       'premium-slab--tier-9',
  AGS_9_5:     'premium-slab--tier-9-5',
  AGS_10:      'premium-slab--tier-10',
  BLACK_LABEL: 'premium-slab--tier-10 premium-slab--tier-black-label',
};

const TIER_SHORT_LABEL = {
  AGS_6:       ['PLAYED'],
  AGS_7:       ['NEAR', 'MINT'],
  AGS_8:       ['MINT'],
  AGS_9:       ['GEM', 'MINT'],
  AGS_9_5:     ['PRISTINE'],
  AGS_10:      ['ARCHIVE', 'PRISTINE'],
  BLACK_LABEL: ['BLACK', 'LABEL'],
};

function turnaroundLabel(tierKey) {
  const ms = SUBMISSION_TIERS?.[tierKey]?.durationMs;
  if (!Number.isFinite(ms)) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60)         return `${mins} MIN`;
  if (mins % 60 === 0)   return `${mins / 60} HR`;
  return `${(mins / 60).toFixed(1)} HR`;
}

const LAUREL_SVG = `
  <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    <path d="M 8 30 Q 10 18 18 12 M 12 22 Q 14 18 18 17 M 14 28 Q 16 24 20 23 M 14 34 Q 16 30 20 29 M 14 40 Q 16 36 20 35 M 12 46 Q 14 42 18 41 M 8 30 Q 10 42 18 48"/>
    <path d="M 52 30 Q 50 18 42 12 M 48 22 Q 46 18 42 17 M 46 28 Q 44 24 40 23 M 46 34 Q 44 30 40 29 M 46 40 Q 44 36 40 35 M 48 46 Q 46 42 42 41 M 52 30 Q 50 42 42 48"/>
  </svg>`;

const BARCODE_WIDTHS = [2,1,1,2,1,3,1,1,2,1,1,2,1,3,1,1,2,1,1,2,1,1,3,1,1,2,1,1,2,1];

function safeText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtSubVal(v) {
  const n = Number(v) || 0;
  return (n / 10).toFixed(1).replace(/\.0$/, '');
}

/**
 * Render the premium nested-shell slab. Heavier than renderSlab — only
 * use in the full-screen viewer / reveal moments, not in list grids.
 *
 * @param {object} slab     — GradedSlab from agsSubmissionManager
 * @param {object} apiCard  — pokemontcg.io card
 * @returns {HTMLElement}
 */
export function renderPremiumSlab(slab, apiCard) {
  const tierId  = slab?.grade?.tier?.id || 'AGS_6';
  const numeric = String(slab?.grade?.numeric ?? '?');
  const label   = slab?.grade?.label || tierLabel(tierId);
  const tierCls = TIER_CLASS_MAP[tierId] || TIER_CLASS_MAP.AGS_6;
  const longGrade = numeric.length >= 3;

  const sub = slab?.grade?.subgrades || {};
  const subRows = [
    ['CENTERING', sub.centering],
    ['SURFACE', sub.surface],
    ['EDGES', sub.edges],
    ['CORNERS', sub.corners],
    ['PRINT QUALITY', sub.printQuality],
  ];

  const cardName = (apiCard?.name || 'CARD').toUpperCase();
  const setName  = (apiCard?.set?.name || '').toUpperCase();
  const setNum   = apiCard?.number ? `#${apiCard.number}` : '';
  const rarity   = (apiCard?.rarity || '').toUpperCase();
  const imgUrl   = apiCard?.images?.large || apiCard?.images?.small || '';
  const serial   = slab?.serial || '';

  const gradedAt = slab?.gradedAt ? new Date(slab.gradedAt) : null;
  const dateStr  = gradedAt
    ? gradedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    : '—';
  const service  = slab?.tier
    ? slab.tier === 'prestige' ? 'PRESTIGE ARCHIVE'
      : slab.tier === 'priority' ? 'PRIORITY'
      : 'STANDARD'
    : '—';
  const turnaround = turnaroundLabel(slab?.tier);

  const labelWords = (TIER_SHORT_LABEL[tierId] || [label.toUpperCase()])
    .map(w => `<span style="display:block">${safeText(w)}</span>`).join('');

  const subRowsHTML = subRows.map(([key, val]) => `
    <div class="premium-slab__sub-row">
      <span class="premium-slab__sub-key">${safeText(key)}</span>
      <span class="premium-slab__sub-bar" style="--w:${(Number(val) || 0)}%"></span>
      <span class="premium-slab__sub-val">${fmtSubVal(val)}</span>
    </div>`).join('');

  const barcodeHTML = BARCODE_WIDTHS
    .map(w => `<span style="width:${w}px"></span>`).join('');

  const cardImgHTML = imgUrl
    ? `<img class="premium-slab__card" src="${safeText(imgUrl)}" alt="${safeText(apiCard?.name || 'card')}" loading="eager" decoding="async" />`
    : `<div class="premium-slab__card premium-slab__card--fallback">
         ${safeText(cardName)}<br/>${safeText(rarity)}<br/>${safeText(setName)}
       </div>`;

  const root = document.createElement('div');
  root.className = `premium-slab ${tierCls}`;
  if (slab?.prestigeSlab) root.classList.add('premium-slab--prestige');
  root.dataset.slabUid = slab?.uid || '';

  root.innerHTML = `
    <div class="premium-slab__outer-shell">
      <div class="premium-slab__inner-shell">

        <div class="premium-slab__panel premium-slab__label">
          <div class="premium-slab__label-brand">
            <div class="premium-slab__label-logo">AGS</div>
            <div class="premium-slab__label-sub">ARCHIVE<br/>GRADING<br/>SERVICES</div>
          </div>
          <div class="premium-slab__label-center">
            <div class="premium-slab__label-name">${safeText(cardName)}</div>
            <div class="premium-slab__label-set">${safeText(setName)} <em>${safeText(setNum)}</em></div>
            <div class="premium-slab__label-rarity">${safeText(rarity)}</div>
            <div class="premium-slab__barcode">${barcodeHTML}</div>
            <div class="premium-slab__label-cert">${safeText(serial)}</div>
          </div>
          <div class="premium-slab__label-grade">
            <div class="premium-slab__label-grade-num${longGrade ? ' premium-slab__label-grade-num--small' : ''}">${safeText(numeric)}</div>
            <div class="premium-slab__label-grade-name">${labelWords}</div>
          </div>
        </div>

        <div class="premium-slab__gem"><span>AGS</span></div>

        <div class="premium-slab__panel premium-slab__chamber">
          <div class="premium-slab__chamber-inner">${cardImgHTML}</div>
        </div>

        <div class="premium-slab__panel premium-slab__subgrades">
          <div class="premium-slab__sub-col">
            <div class="premium-slab__col-title">SUBGRADE BREAKDOWN</div>
            <div class="premium-slab__sub-list">${subRowsHTML}</div>
          </div>
          <div class="premium-slab__medal">
            <div class="premium-slab__medal-laurel">${LAUREL_SVG}</div>
            <div class="premium-slab__medal-num">${safeText(numeric)}</div>
            <div class="premium-slab__medal-lbl">${labelWords}</div>
          </div>
          <div class="premium-slab__sub-col">
            <div class="premium-slab__col-title">ARCHIVE DETAILS</div>
            <div class="premium-slab__details">
              <div class="premium-slab__details-row">
                <span class="premium-slab__details-lbl">DATE GRADED</span>
                <span class="premium-slab__details-val">${safeText(dateStr)}</span>
              </div>
              <div class="premium-slab__details-row">
                <span class="premium-slab__details-lbl">SERVICE LEVEL</span>
                <span class="premium-slab__details-val">${safeText(service)}</span>
              </div>
              <div class="premium-slab__details-row">
                <span class="premium-slab__details-lbl">TURNAROUND</span>
                <span class="premium-slab__details-val">${safeText(turnaround)}</span>
              </div>
              <div class="premium-slab__details-row">
                <span class="premium-slab__details-lbl">SERIAL NUMBER</span>
                <span class="premium-slab__details-val">${safeText(serial)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="premium-slab__pin"><span>AGS</span></div>

        <div class="premium-slab__light-overlay"></div>
        <div class="premium-slab__edge-reflections">
          <span class="premium-slab__refr premium-slab__refr--tl"></span>
          <span class="premium-slab__refr premium-slab__refr--tr"></span>
          <span class="premium-slab__refr premium-slab__refr--bl"></span>
          <span class="premium-slab__refr premium-slab__refr--br"></span>
        </div>
        <div class="premium-slab__specular"></div>
      </div>

      <span class="premium-slab__outer-corner premium-slab__outer-corner--tl"></span>
      <span class="premium-slab__outer-corner premium-slab__outer-corner--tr"></span>
      <span class="premium-slab__outer-corner premium-slab__outer-corner--bl"></span>
      <span class="premium-slab__outer-corner premium-slab__outer-corner--br"></span>
    </div>
  `;
  return root;
}
