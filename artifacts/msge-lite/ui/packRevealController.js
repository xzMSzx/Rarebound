/**
 * ui/packRevealController.js
 * Orchestrates the full pack reveal sequence.
 *
 * Flow:
 *   1. Render 5 face-down card backs in #card-reveal-area
 *   2. If pack contains Epic/Legendary: apply suspense glow + dramatic pause
 *   3. Flip each card sequentially (300 ms apart)
 *   4. Apply rarity glow and legendary pulse after each flip
 *   5. Update status message
 */

import {
  animateCardReveal,
  applySuspenseGlow,
  removeSuspenseGlow,
  applyRarityGlow,
  delay,
} from './animationSystem.js';
import { normalizeRarityKey } from '../data/cardVisualMapper.js';

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function getRevealArea()  { return document.getElementById('card-reveal-area'); }
function getPackStatus()  { return document.getElementById('pack-status'); }

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Clear the animation area (call before batch runs or on reset).
 */
export function clearRevealArea() {
  const area = getRevealArea();
  if (area) area.innerHTML = '';
  const status = getPackStatus();
  if (status) { status.textContent = ''; status.className = 'pack-status-msg'; }
}

/**
 * Run the full animated reveal for one pack of 5 cards.
 * @param {Object[]} cards      Array of 5 { id, rarity, packNumber } card objects
 * @param {number}   packNumber The pack index, used in the status message
 * @returns {Promise<void>}     Resolves when all animations are complete
 */
export async function revealPack(cards, packNumber) {
  const area = getRevealArea();
  const status = getPackStatus();
  if (!area) return;

  // Clear previous result
  area.innerHTML = '';
  if (status) { status.textContent = ''; status.className = 'pack-status-msg'; }

  // Detect whether any card warrants suspense treatment
  const hasSuspense = cards.some((c) => {
    const rarity = normalizeRarityKey(c.rarity) || 'common';
    return rarity !== 'common' && rarity !== 'uncommon' && rarity !== 'rare';
  });

  // ── Build all card DOM nodes ──────────────────────────────────────────────

  const cardWrappers = [];   // outer wrapper elements (for glow classes)
  const cardInners   = [];   // inner flipping elements

  for (let i = 0; i < cards.length; i++) {
    const rarity = normalizeRarityKey(cards[i].rarity) || 'common';

    // Outer wrapper (perspective + glow target)
    const wrapper = document.createElement('div');
    wrapper.className = `reveal-card-wrapper rarity-${rarity}`;

    // Inner flipping element
    const inner = document.createElement('div');
    inner.className = 'reveal-card-inner';

    // Front face — mystery card back (shown first)
    const front = document.createElement('div');
    front.className = 'reveal-card-face reveal-card-mystery';
    front.innerHTML = '<span class="mystery-icon">?</span>';

    // Back face — rarity card (hidden until flip)
    const back = document.createElement('div');
    back.className = `reveal-card-face reveal-card-back rarity-face-${rarity}`;
    back.innerHTML = `
      <span class="reveal-rarity-label">${rarity.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
    `;

    inner.appendChild(front);
    inner.appendChild(back);
    wrapper.appendChild(inner);
    area.appendChild(wrapper);

    cardWrappers.push(wrapper);
    cardInners.push({ inner, wrapper, rarity });
  }

  // ── Suspense pre-glow ─────────────────────────────────────────────────────

  if (hasSuspense) {
    applySuspenseGlow(cardWrappers);
    if (status) {
      status.textContent = `Opening Pack #${packNumber}...`;
      status.className = 'pack-status-msg status-suspense';
    }
    await delay(600); // dramatic pause before reveal begins
  } else {
    if (status) status.textContent = `Opening Pack #${packNumber}...`;
    await delay(200);
  }

  // ── Sequential card reveals ───────────────────────────────────────────────

  for (let i = 0; i < cardInners.length; i++) {
    const { inner, wrapper, rarity } = cardInners[i];
    const isSuspenseCard = rarity !== 'common' && rarity !== 'uncommon' && rarity !== 'rare';

    // Remove suspense pre-glow just before this card flips
    removeSuspenseGlow(wrapper);

    await animateCardReveal(inner, rarity, isSuspenseCard);

    // Post-flip: apply rarity glow
    applyRarityGlow(wrapper, rarity);

    await delay(300); // gap between cards
  }

  // ── Final status message ──────────────────────────────────────────────────

  if (status) {
    const rarities = cards.map((c) => normalizeRarityKey(c.rarity) || 'common');
    const order = ['hyper', 'sir', 'ultra-rare', 'ir', 'double-rare', 'holo', 'rare', 'uncommon', 'common'];
    const best = order.find((tier) => rarities.includes(tier)) || 'common';

    const msgs = {
      hyper:      '★☆ Hyper Rare pull! ☆★',
      sir:        '★ Special Illustration Rare pulled!',
      'ultra-rare': '★ Ultra Rare pull!',
      ir:         '★ Illustration Rare hit!',
      'double-rare': '★ Double Rare hit!',
      holo:       '★ Holo pull!',
      rare:       'Rare hit!',
      uncommon:   'Uncommon pack pull.',
      common:     'Pack opened.',
    };

    status.textContent = msgs[best];
    status.className = `pack-status-msg status-${best}`;
  }
}
