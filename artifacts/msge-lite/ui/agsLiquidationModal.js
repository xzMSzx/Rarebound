/**
 * ui/agsLiquidationModal.js
 *
 * Premium cinematic modal for liquidating a graded AGS slab.
 *
 * Presents a financial breakdown based on the realistic collector economy
 * formula and requires the user to confirm the irreversible sale.
 */

import { calculateSlabQuote } from '../data/archiveLiquidation.js';
import { removeSlabFromArchive } from '../data/agsSubmissionManager.js';
import { addLifetimeRevenue } from '../data/statsManager.js';
import { recordArchiveEvent } from '../data/archiveHistoryManager.js';
import { recordChronologicalCollectionSnapshot } from '../data/collectionValueHistory.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';
import { onEscapeKey } from './overlayScrollLock.js';
import { renderSlab } from './slabRenderer.js';
import { tierLabel } from '../data/agsGradingEngine.js';

/**
 * Open the liquidation modal.
 *
 * @param {object} slab - The slab to liquidate.
 * @param {object} apiCard - The underlying API card metadata.
 * @param {object} hooks - App hooks (e.g. getBalance, addBalance, showToast, haptic)
 * @param {object} [opts]
 * @param {number} [opts.rawValue] - Pre-computed raw market value.
 * @param {() => void} [opts.onSaleComplete] - Callback on success.
 */
export function openAgsLiquidationModal(slab, apiCard, hooks, opts = {}) {
  const quote = calculateSlabQuote(slab, opts.rawValue);
  
  // 1. Create or get dedicated top-level host
  let host = document.getElementById('global-modal-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'global-modal-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '99999';
    host.style.pointerEvents = 'none'; // let clicks pass through when empty
    document.body.appendChild(host);
  }
  
  const root = document.createElement('div');
  root.className = 'ags-modal-overlay liq-overlay-host';
  root.style.pointerEvents = 'auto'; // catch clicks for the modal itself
  
  const cardName = apiCard?.name || slab.cardId;
  const gradeLabel = slab.grade?.label || 'Graded';
  const tierName = slab.grade?.tier?.id ? tierLabel(slab.grade.tier.id) : '';
  const serviceTierName = slab.tier ? slab.tier[0].toUpperCase() + slab.tier.slice(1) : 'Standard';

  let marketDescriptor = "Secondary market active";
  if (quote.isPrivateCollector) {
    marketDescriptor = "Prestige private collector acquisition detected";
  } else if (slab.prestigeSlab) {
    marketDescriptor = "Elite archival interest detected";
  } else if (quote.liquidityModifier > 1.0) {
    marketDescriptor = "Collector demand elevated";
  } else if (quote.liquidityModifier > 0.85) {
    marketDescriptor = "Prestige archival buyers available";
  }

  root.innerHTML = `
    <style>
      .ags-modal-overlay.liq-overlay-host {
        position: absolute !important; /* absolute relative to the fixed 0,0,0,0 host */
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 1 !important;
      }
      .liq-modal-panel {
        position: relative !important;
        margin: auto !important;
        width: min(540px, 92vw) !important;
        max-height: 92vh !important;
        overflow-y: auto !important;
        z-index: 2 !important;
      }
      @media (max-width: 600px) {
        .liq-modal-panel {
          width: min(92vw, 460px) !important;
        }
      }
      .liq-btn-confirm {
        height: 52px;
        font-size: 16px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(180deg, #10b981 0%, #059669 100%);
        border: 1px solid #34d399;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .liq-btn-confirm:active {
        transform: scale(0.98);
      }
      .liq-btn-confirm:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .liq-btn-cancel {
        height: 52px;
        font-size: 15px;
        color: #fff;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        cursor: pointer;
      }
      .liq-value-final {
        font-size: 24px;
        font-weight: 800;
        color: #4ade80;
        text-shadow: 0 0 16px rgba(74, 222, 128, 0.3);
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.1);
      }
      .liq-value-final span:first-child {
        font-size: 16px;
        font-weight: 600;
        color: #a7f3d0;
      }
      .liq-overlay-bg {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, rgba(5,5,7,0.85) 0%, rgba(0,0,0,0.95) 100%);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 0;
      }
    </style>
    <div class="liq-overlay-bg" class="ags-modal__backdrop" id="liq-backdrop"></div>
    <div class="ags-modal__panel liq-modal-panel" role="dialog" aria-label="Archive Liquidation">
      <button class="ags-modal__close" type="button" aria-label="Close">×</button>

      <div class="ags-modal__head">
        <div class="ags-modal__brand">Archive Grading Services</div>
        <div class="ags-modal__title" style="color: #ff8080;">Archive Liquidation</div>
      </div>

      <div class="ags-modal__card-row" style="align-items: center; gap: 20px;">
        <div class="liquidation-slab-host" style="width: 120px; flex-shrink: 0; transform-origin: top center;"></div>
        <div class="ags-modal__card-meta" style="flex: 1;">
          <div class="ags-modal__card-name" style="font-size: 1.1rem;">${cardName}</div>
          <div class="ags-modal__card-rarity" style="color: rgba(255,215,0,0.9); font-size: 0.85rem;">${gradeLabel} ${tierName ? '· ' + tierName : ''}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Service: ${serviceTierName} Archive</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px;">Cert: ${slab.serial || '—'}</div>
          <div class="ags-modal__hint" style="margin-top: 10px; color: #a7f3d0; font-weight: 500;">${marketDescriptor}</div>
        </div>
      </div>

      <div style="margin: 16px 0; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: rgba(255,255,255,0.4);">
          <span>Theoretical Slab Value</span>
          <span>$${quote.slabValue.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: rgba(255,255,255,0.7);">
          <span>Estimated Collector Payout</span>
          <span>$${quote.estimatedPayout.toFixed(2)}</span>
        </div>
        ${quote.prestigeBonus > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #ffd700;">
          <span>Prestige Service Bonus</span>
          <span>+$${quote.prestigeBonus.toFixed(2)}</span>
        </div>
        ` : ''}
        ${quote.isPrivateCollector ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #60a5fa;">
          <span>Private Acquisition Premium</span>
          <span>Included</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #ef4444;">
          <span>Archive Commission (${(quote.commissionRate * 100).toFixed(0)}%)</span>
          <span>-$${quote.commission.toFixed(2)}</span>
        </div>
        
        <div class="liq-value-final">
          <span>Final Transfer Amount</span>
          <span>$${quote.finalTransfer.toFixed(2)}</span>
        </div>
      </div>

      <div class="ags-modal__footnote" style="color: rgba(255, 128, 128, 0.8); text-align: center; font-size: 12px; margin-bottom: 16px;">
        Certified assets are transferred permanently. The archive census will update and this action is irreversible.
      </div>
      
      <div style="display: flex; gap: 12px; margin-top: 16px;">
        <button class="liq-btn-cancel" id="liq-cancel" style="flex: 1;">Cancel</button>
        <button class="liq-btn-confirm" id="liq-confirm" style="flex: 1.5;">Confirm Sale</button>
      </div>
    </div>
  `;
  host.appendChild(root);
  lockBodyScroll();

  const slabHost = root.querySelector('.liquidation-slab-host');
  const slabEl = renderSlab(slab, apiCard, { variant: 'compact', showSerial: true });
  slabHost.appendChild(slabEl);

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
      if (host.childNodes.length === 0) {
        host.remove();
      }
    }, 200);
  };
  
  requestAnimationFrame(() => root.classList.add('is-visible'));

  root.querySelector('.ags-modal__close')?.addEventListener('click', close);
  root.querySelector('#liq-backdrop')?.addEventListener('click', close);
  root.querySelector('#liq-cancel')?.addEventListener('click', close);

  disposeEscape = onEscapeKey((e) => {
    e.preventDefault();
    close();
  });

  const confirmBtn = root.querySelector('#liq-confirm');
  confirmBtn?.addEventListener('click', () => {
    if (closed) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    
    // 1. Remove from archive
    const removed = removeSlabFromArchive(slab.uid);
    if (!removed) {
      hooks.showToast?.('Error: Slab no longer found in archive.', 'warn');
      close();
      return;
    }
    
    // 2. Add balance
    try {
      hooks.addBalance?.(quote.finalTransfer);
      hooks.onBalanceChanged?.();
    } catch (e) {
      console.error('[Liquidation] Failed to add balance', e);
    }
    
    // 3 & 5. Update history & stats
    try { addLifetimeRevenue(quote.finalTransfer); } catch {}
    try { recordChronologicalCollectionSnapshot(); } catch {}
    
    // 4 & 6. Archive log & visual feedback
    try {
      const isHighValue = quote.finalTransfer >= 500;
      const isPrestige = slab.prestigeSlab;
      const isPrivate = quote.isPrivateCollector;
      const evtType = 'archive_record';

      let logTitle = `Museum-grade certification liquidated • ${gradeLabel} • $${quote.finalTransfer.toFixed(0)}`;

      if (isPrivate) {
        logTitle = `Private archival buyer secured • ${cardName} • $${quote.finalTransfer.toFixed(0)}`;
      } else if (isHighValue) {
        logTitle = `Elite collector transfer completed • $${quote.finalTransfer.toFixed(0)}`;
      } else if (isPrestige) {
        logTitle = `Prestige archive transferred • ${cardName} • $${quote.finalTransfer.toFixed(0)}`;
      } else if (quote.finalTransfer >= 1000) {
        logTitle = `Collector consortium acquisition • ${cardName} • $${quote.finalTransfer.toFixed(0)}`;
      }

      const shouldRecordArchiveSale = quote.finalTransfer >= 1000 || quote.isPrivateCollector || isPrestige;
      if (shouldRecordArchiveSale) {
        recordArchiveEvent(evtType, logTitle, {
          meta: {
            cardId: slab.cardId,
            price: quote.finalTransfer
          }
        });
      }

      hooks.logActivity?.(
        'ags_complete',
        `Archive Liquidation • ${cardName} sold for $${quote.finalTransfer.toFixed(0)}`
      );

    } catch (e) {
      console.error('[Liquidation] Failed to record event', e);
    }

    hooks.haptic?.('heavy');

    const toastMsg = quote.isPrivateCollector 
      ? `Prestige collector acquisition finalized (+$${quote.finalTransfer.toFixed(2)})`
      : `+$${quote.finalTransfer.toFixed(2)} archival transfer completed`;

    hooks.showToast?.(toastMsg, 'sell');

    // Trigger subtle AGS audio cue if available
    if (hooks.playAudio) {
        hooks.playAudio('ags_complete'); // Example audio cue
    }

    close();
    opts.onSaleComplete?.();
  });

  return { close };
}