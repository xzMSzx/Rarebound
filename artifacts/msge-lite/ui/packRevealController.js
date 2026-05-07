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
  applyLegendaryEffect,
  delay,
} from './animationSystem.js';

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
  const hasSuspense = cards.some(
    (c) => c.rarity === 'epic' || c.rarity === 'legendary'
  );

  // ── Build all card DOM nodes ──────────────────────────────────────────────

  const cardWrappers = [];   // outer wrapper elements (for glow classes)
  const cardInners   = [];   // inner flipping elements

  for (let i = 0; i < cards.length; i++) {
    const rarity = cards[i].rarity;

    // Outer wrapper (perspective + glow target)
    const wrapper = document.createElement('div');
    wrapper.className = 'reveal-card-wrapper';

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
      <span class="reveal-rarity-label">${rarity.charAt(0).toUpperCase() + rarity.slice(1)}</span>
      <span class="reveal-slot-label">Slot ${i + 1}</span>
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
    const isSuspenseCard = rarity === 'epic' || rarity === 'legendary';

    // Remove suspense pre-glow just before this card flips
    removeSuspenseGlow(wrapper);

    await animateCardReveal(inner, rarity, isSuspenseCard);

    // Post-flip: apply rarity glow
    applyRarityGlow(wrapper, rarity);

    // Legendary gets the golden pulse on top of the glow
    if (rarity === 'legendary') applyLegendaryEffect(wrapper);

    await delay(300); // gap between cards
  }

  // ── Final status message ──────────────────────────────────────────────────

  if (status) {
    const rarities = cards.map((c) => c.rarity);
    const best = rarities.includes('legendary') ? 'legendary'
      : rarities.includes('epic')      ? 'epic'
      : rarities.includes('rare')      ? 'rare'
      : 'common';

    const msgs = {
      legendary: '★★ LEGENDARY PULL! ★★',
      epic:      '★ Epic card pulled!',
      rare:      'Rare hit!',
      common:    'Pack opened.',
    };

    status.textContent = msgs[best];
    status.className = `pack-status-msg status-${best}`;
  }
}
