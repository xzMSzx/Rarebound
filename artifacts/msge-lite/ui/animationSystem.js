/**
 * ui/animationSystem.js
 * Low-level animation primitives: card flips, glow effects, suspense, legendary pulse.
 *
 * This module has no knowledge of the simulation engine.
 * It only operates on DOM elements passed in from outside.
 */

/**
 * Utility: wait for ms milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply a rarity-appropriate glow class to a card wrapper.
 * @param {HTMLElement} element
 * @param {string} rarity - 'common' | 'rare' | 'epic' | 'legendary'
 */
export function applyRarityGlow(element, rarity) {
  element.classList.remove('glow-common', 'glow-rare', 'glow-epic', 'glow-legendary');
  element.classList.add('glow-' + rarity);
}

/**
 * Apply a faint pre-reveal glow to card back elements (suspense effect).
 * @param {HTMLElement[]} elements
 */
export function applySuspenseGlow(elements) {
  for (const el of elements) {
    el.classList.add('suspense-glow');
  }
}

/**
 * Remove the suspense glow from a card wrapper.
 * @param {HTMLElement} element
 */
export function removeSuspenseGlow(element) {
  element.classList.remove('suspense-glow');
}

/**
 * Flip a card's inner element to reveal the face side.
 * Returns a Promise that resolves once the flip CSS transition completes.
 *
 * @param {HTMLElement} cardInner  - The .reveal-card-inner element
 * @param {boolean} slow           - Use a slower flip for suspense cards
 * @returns {Promise<void>}
 */
export function flipCard(cardInner, slow = false) {
  return new Promise((resolve) => {
    const duration = slow ? 600 : 300;
    if (slow) cardInner.classList.add('flip-slow');
    cardInner.classList.add('flipped');
    setTimeout(resolve, duration);
  });
}

/**
 * Apply a brief shake animation to an element before its flip.
 * @param {HTMLElement} element
 * @returns {Promise<void>}
 */
export function shakeElement(element) {
  return new Promise((resolve) => {
    element.classList.add('suspense-shake');
    setTimeout(() => {
      element.classList.remove('suspense-shake');
      resolve();
    }, 400);
  });
}

/**
 * Full card reveal animation sequence for one card.
 * Handles standard and suspense-card flows.
 *
 * @param {HTMLElement} cardInner   - .reveal-card-inner
 * @param {string} rarity
 * @param {boolean} isSuspenseCard  - true when this specific card is epic/legendary
 * @returns {Promise<void>}
 */
export async function animateCardReveal(cardInner, rarity, isSuspenseCard = false) {
  if (isSuspenseCard) {
    await shakeElement(cardInner);
    await flipCard(cardInner, true); // slower flip
  } else {
    await flipCard(cardInner, false);
  }
}

/**
 * Apply the legendary golden pulse to a card wrapper.
 * @param {HTMLElement} element
 */
export function applyLegendaryEffect(element) {
  element.classList.add('legendary-pulse');
}
