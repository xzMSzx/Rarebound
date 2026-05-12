/**
 * ui/agsSubmissionModal.js — v1.5.0
 *
 * Premium AGS submission modal. Player picks a service tier (Standard /
 * Priority / Prestige), confirms the cost, and the card transitions into
 * the active-review queue.
 *
 * Hands off to a caller-provided `onSubmit({tier, cost, durationMs})`
 * callback so this module never has to know about the player's wallet
 * or the reset of the submission lifecycle.
 *
 * The modal keeps its own DOM root and removes itself on close.
 */

import { SUBMISSION_TIERS } from '../data/agsSubmissionManager.js';
import { atmosphericHint } from '../data/agsGradingEngine.js';

/**
 * @param {object} apiCard       — pokemontcg.io card object
 * @param {object} args
 * @param {object} args.quality  — hidden quality record (for atmospheric hint)
 * @param {string} args.rarityLabel
 * @param {number} args.estimatedRawValue
 * @param {number} args.balance  — current player balance (for affordability display)
 * @param {(arg: { tier: string, cost: number, durationMs: number }) => void} args.onSubmit
 * @param {() => void} [args.onClose]
 */
export function showAgsSubmissionModal(apiCard, args) {
  const { quality, rarityLabel, estimatedRawValue, balance, onSubmit, onClose } = args;

  const root = document.createElement('div');
  root.className = 'ags-modal-overlay';
  root.innerHTML = `
    <div class="ags-modal__backdrop"></div>
    <div class="ags-modal__panel" role="dialog" aria-label="Submit to AGS">
      <button class="ags-modal__close" type="button" aria-label="Close">×</button>

      <div class="ags-modal__head">
        <div class="ags-modal__brand">Archive Grading Services</div>
        <div class="ags-modal__title">Submit for Certification</div>
      </div>

      <div class="ags-modal__card-row">
        ${apiCard?.images?.large || apiCard?.images?.small
          ? `<img class="ags-modal__card-art" src="${apiCard.images.large || apiCard.images.small}" alt="${apiCard?.name || ''}" />`
          : `<div class="ags-modal__card-art ags-modal__card-art--missing">${apiCard?.name || ''}</div>`
        }
        <div class="ags-modal__card-meta">
          <div class="ags-modal__card-name">${apiCard?.name || ''}</div>
          <div class="ags-modal__card-rarity">${rarityLabel || ''}</div>
          <div class="ags-modal__card-value">Raw market value · $${(estimatedRawValue || 0).toFixed(2)}</div>
          <div class="ags-modal__hint">${atmosphericHint(quality)}</div>
        </div>
      </div>

      <div class="ags-modal__tiers">
        ${tierTile(SUBMISSION_TIERS.standard, balance)}
        ${tierTile(SUBMISSION_TIERS.priority, balance)}
        ${tierTile(SUBMISSION_TIERS.prestige, balance)}
      </div>

      <div class="ags-modal__footnote">
        Submissions lock the underlying copy until certification completes.
        Grades are determined by the card's preserved condition — no submission
        tier influences the final grade.
      </div>
    </div>
  `;
  document.body.appendChild(root);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.add('is-closing');
    setTimeout(() => {
      root.remove();
      onClose?.();
    }, 200);
  };
  requestAnimationFrame(() => root.classList.add('is-visible'));

  root.querySelector('.ags-modal__close')?.addEventListener('click', close);
  root.querySelector('.ags-modal__backdrop')?.addEventListener('click', close);

  root.querySelectorAll('[data-tier-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tierId = btn.getAttribute('data-tier-id');
      const tier   = SUBMISSION_TIERS[tierId];
      if (!tier) return;
      if (balance < tier.cost) return;  // visual disabled state already prevents this
      onSubmit?.({ tier: tier.id, cost: tier.cost, durationMs: tier.durationMs });
      close();
    });
  });

  return { close };
}

function tierTile(tier, balance) {
  const affordable = balance >= tier.cost;
  return `
    <button class="ags-modal__tier ${tier.prestigeSlab ? 'ags-modal__tier--prestige' : ''} ${affordable ? '' : 'is-disabled'}"
            data-tier-id="${tier.id}" type="button" ${affordable ? '' : 'disabled aria-disabled="true"'}>
      <div class="ags-modal__tier-head">
        <span class="ags-modal__tier-label">${tier.label}</span>
        <span class="ags-modal__tier-cost">$${tier.cost}</span>
      </div>
      <div class="ags-modal__tier-blurb">${tier.blurb}</div>
      <div class="ags-modal__tier-meta">
        <span>${tier.durationLabel}</span>
        ${tier.prestigeSlab ? `<span class="ags-modal__tier-flag">Premium slab variant</span>` : ''}
      </div>
      ${affordable ? '' : '<div class="ags-modal__tier-locked">Insufficient funds</div>'}
    </button>
  `;
}
