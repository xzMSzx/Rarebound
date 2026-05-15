/**
 * ui/slabViewer.js — v1.5.0
 *
 * Full-screen "museum-grade" graded-slab inspection view. Opened from the
 * Archive Registry, the binder slab badge, or the activity feed.
 *
 * Visual: a darkened stage with the slab centered, a soft tilt-light gloss,
 * full subgrade breakdown, certification serial, and live valuation
 * (raw × multiplier). No animation loops — single one-shot reveal so we
 * stay friendly on mobile Safari battery.
 */

import { renderSlab, renderPremiumSlab } from './slabRenderer.js';
import { tierLabel } from '../data/agsGradingEngine.js';
import { gradedValueFromRaw } from '../data/agsMarketIntegration.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';
import { onEscapeKey } from './overlayScrollLock.js';
import { openAgsLiquidationModal } from './agsLiquidationModal.js';

/**
 * @param {object} slab     — GradedSlab from agsSubmissionManager
 * @param {object} apiCard  — pokemontcg.io card object
 * @param {object} [opts]
 * @param {number} [opts.rawValue]   — current raw market value for valuation panel
 * @param {() => void} [opts.onClose]
 * @param {object} [opts.hooks]      — AGS_SCREEN_HOOKS for liquidation
 */
export function openSlabViewer(slab, apiCard, opts = {}) {
  const root = document.createElement('div');
  root.className = `slab-viewer ags-tier-${(slab?.grade?.tier?.id || 'AGS_6').toLowerCase()}`;
  if (slab?.prestigeSlab) root.classList.add('slab-viewer--prestige');

  const tierName = slab?.grade?.name || tierLabel(slab?.grade?.tier?.id);
  const sub      = slab?.grade?.subgrades || {};
  const rawValue = Number.isFinite(opts.rawValue) ? opts.rawValue : 0;
  const graded   = gradedValueFromRaw(rawValue, slab?.grade);

  const submittedAt = slab?.submittedAt ? new Date(slab.submittedAt) : null;
  const gradedAt    = slab?.gradedAt    ? new Date(slab.gradedAt)    : null;
  const fmtDate = (d) => d ? d.toISOString().slice(0, 10) : '—';

  root.innerHTML = `
    <div class="slab-viewer__backdrop"></div>
    <div class="slab-viewer__stage">
      <button class="slab-viewer__close" type="button" aria-label="Close">×</button>

      <div class="slab-viewer__header">
        <div class="slab-viewer__brand">Archive Grading Services</div>
        <div class="slab-viewer__cert">${slab?.serial || ''}</div>
      </div>

      <div class="slab-viewer__slab-wrap"></div>

      <div class="slab-viewer__body">
        <div class="slab-viewer__panel">
          <div class="slab-viewer__panel-label">Grade Breakdown</div>
          <div class="slab-viewer__final">${slab?.grade?.label || ''} · ${tierName}</div>
          <div class="slab-viewer__avg">Weighted average · ${(slab?.grade?.average ?? 0).toFixed(1)}</div>
          <div class="slab-viewer__subs">
            ${subRow('Centering',    sub.centering)}
            ${subRow('Surface',      sub.surface)}
            ${subRow('Edges',        sub.edges)}
            ${subRow('Corners',      sub.corners)}
            ${subRow('Print Quality', sub.printQuality)}
          </div>
        </div>

        <div class="slab-viewer__panel">
          <div class="slab-viewer__panel-label">Valuation</div>
          <div class="slab-viewer__val-row"><span>Raw market value</span><span>$${rawValue.toFixed(2)}</span></div>
          <div class="slab-viewer__val-row"><span>Archive multiplier</span><span>${(slab?.grade?.multiplier || 1).toFixed(2)}×</span></div>
          <div class="slab-viewer__val-row slab-viewer__val-row--total"><span>Slab valuation</span><span>$${graded.toFixed(2)}</span></div>
        </div>

        <div class="slab-viewer__panel">
          <div class="slab-viewer__panel-label">Archive Notes</div>
          <div class="slab-viewer__note-row"><span>Submitted</span><span>${fmtDate(submittedAt)}</span></div>
          <div class="slab-viewer__note-row"><span>Certified</span><span>${fmtDate(gradedAt)}</span></div>
          <div class="slab-viewer__note-row"><span>Service tier</span><span>${slab?.tier ? slab.tier[0].toUpperCase() + slab.tier.slice(1) : '—'}</span></div>
          <div class="slab-viewer__note-row"><span>Slab variant</span><span>${slab?.prestigeSlab ? 'Prestige Archive' : 'Standard Archive'}</span></div>
        </div>
        
        <div class="slab-viewer__actions" style="margin-top: 16px;">
          <button class="slab-viewer__sell-btn" id="slab-viewer-sell" type="button" style="
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, rgba(218, 165, 32, 0.1), rgba(255, 215, 0, 0.05));
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 8px;
            color: rgba(255, 215, 0, 0.9);
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            box-shadow: inset 0 0 10px rgba(255,215,0,0.05);
            transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
          ">Archive Liquidation</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  lockBodyScroll();

  // Mount the slab itself (full variant, with subgrades + serial)
  const slabWrap = root.querySelector('.slab-viewer__slab-wrap');
  // v1.5.2 — use the new premium nested-shell slab in the full-screen viewer.
  // The compact tile (renderSlab) is still used everywhere else.
  slabWrap?.appendChild(renderPremiumSlab(slab, apiCard));

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
    }, 220);
  };
  requestAnimationFrame(() => root.classList.add('is-visible'));
  root.querySelector('.slab-viewer__close')?.addEventListener('click', close);
  root.querySelector('.slab-viewer__backdrop')?.addEventListener('click', close);

  disposeEscape = onEscapeKey((e) => {
    e.preventDefault();
    close();
  });

  const sellBtn = root.querySelector('#slab-viewer-sell');
  if (sellBtn) {
    sellBtn.addEventListener('mouseover', () => {
      sellBtn.style.background = 'linear-gradient(135deg, rgba(218, 165, 32, 0.2), rgba(255, 215, 0, 0.1))';
      sellBtn.style.boxShadow = '0 0 16px rgba(255,215,0,0.2)';
    });
    sellBtn.addEventListener('mouseout', () => {
      sellBtn.style.background = 'linear-gradient(135deg, rgba(218, 165, 32, 0.1), rgba(255, 215, 0, 0.05))';
      sellBtn.style.boxShadow = 'inset 0 0 10px rgba(255,215,0,0.05)';
    });
    sellBtn.addEventListener('click', () => {
      if (!opts.hooks) {
        console.warn('[slabViewer] cannot liquidate without hooks');
        return;
      }
      close();
      setTimeout(() => {
        openAgsLiquidationModal(slab, apiCard, opts.hooks, {
          rawValue,
          onSaleComplete: () => {
            // Re-render AGS screen or binder screen to show the slab is gone
            document.dispatchEvent(new CustomEvent('ags-tick'));
          }
        });
      }, 250);
    });
  }

  return { close };
}

function subRow(label, v) {
  const val = Math.max(0, Math.min(100, Number(v) || 0));
  return `
    <div class="slab-viewer__sub">
      <span class="slab-viewer__sub-label">${label}</span>
      <span class="slab-viewer__sub-bar"><span style="width:${val.toFixed(0)}%"></span></span>
      <span class="slab-viewer__sub-val">${(val / 10).toFixed(1)}</span>
    </div>
  `;
}
