/**
 * ui/cardRenderer.js
 * Renders the card collection grid from engine.state.cards.
 *
 * When a Pokémon set is loaded, cards carry imageUrl + name and are displayed
 * as thumbnail artwork.  Without a set, an SVG rarity icon badge is shown.
 * Both modes share the same grid and rarity border colours.
 *
 * Displays the most recent MAX_DISPLAY_CARDS cards (newest first)
 * to keep DOM size manageable after large batch runs.
 *
 * Phase 4.4.5: SVG icon system restored with explicit hex fills (no
 * currentColor). This eliminates the invisible-icon bug that occurred when
 * the parent container used color:transparent for gradient-text effects.
 */

import { RARITY_ICONS, RARITY_ICON_FALLBACK } from './rarityIcons.js';
import { CARD_RENDER_TIERS, getTierCapabilities } from './renderTiers.js';
import { getCardVisualProfile } from '../data/cardVisualMapper.js';

const MAX_DISPLAY_CARDS = 300;

/**
 * Build a single card element for the collection grid.
 *
 * @param {Object} card - { id, rarity, packNumber, name?, imageUrl? }
 * @returns {HTMLElement}
 */
export function createCardElement(card) {
  const rarity = (card?.visualProfile ?? getCardVisualProfile(card)).rarity;
  const el = document.createElement('div');
  el.className = `grid-card grid-card-${rarity}`;
  el.dataset.renderTier = CARD_RENDER_TIERS.THUMBNAIL;

  if (card.imageUrl) {
    el.classList.add('grid-card-has-img');
    el.title = `${card.name ?? rarity} — Pack #${card.packNumber}`;

    const img = document.createElement('img');
    img.className = 'grid-card-img';
    img.src     = card.imageUrl;
    img.alt     = card.name ?? card.rarity;
    img.loading = 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
  } else {
    el.title = `${rarity} — Pack #${card.packNumber}`;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'grid-card-icon';

    // Parse safe HTML (SVG or span wrappers) to avoid innerHTML assignment
    const iconHtml = RARITY_ICONS[rarity] ?? RARITY_ICON_FALLBACK;
    const parser = new DOMParser();
    const doc = parser.parseFromString(iconHtml, 'text/html');

    // Minimal runtime sanitization: strip executable/active elements just in case
    doc.querySelectorAll('script, iframe, object, embed, img').forEach(el => el.remove());

    // Remove dangerous attributes from all remaining elements
    doc.querySelectorAll('*').forEach(el => {
      // Remove event handler attributes (onclick, onload, etc.)
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });

      // Remove attributes with dangerous URI schemes
      const dangerousUriPattern = /^(\s*)(javascript|vbscript|data):/i;
      ['href', 'src', 'srcset', 'action'].forEach(attrName => {
        const attrValue = el.getAttribute(attrName);
        if (attrValue && dangerousUriPattern.test(attrValue)) {
          el.removeAttribute(attrName);
        }
      });

      // Remove inline style attributes
      el.removeAttribute('style');
    });
    iconWrap.replaceChildren(...doc.body.childNodes);

    const pack = document.createElement('span');
    pack.className = 'grid-card-pack';
    pack.textContent = '#' + card.packNumber;

    el.appendChild(iconWrap);
    el.appendChild(pack);
  }

  // Phase 5.2 — reverse-holo foil shimmer.
  // Slot-8 cards carry isReverseHolo from the engine. Append the foil + sweep
  // overlays last so they paint above the artwork. .grid-card already has
  // position:relative + overflow:hidden so the layers anchor and clip cleanly.
  //
  // Phase 5.2.1 — animations are gated by .reverse-holo-active. Grid cards
  // have no reveal moment to trigger that class, so we add it on creation —
  // the collection gallery is a static display where always-on shimmer is the
  // desired behaviour. Also append a small "RH" badge in the corner.
  const capabilities = getTierCapabilities(CARD_RENDER_TIERS.THUMBNAIL);

  if (card.isReverseHolo && capabilities.holo) {
    el.classList.add('reverse-holo-active');

    const foil = document.createElement('div');
    foil.className = 'reverse-holo-overlay';

    const sweep = document.createElement('div');
    sweep.className = 'reverse-holo-sweep';

    const tag = document.createElement('div');
    tag.className   = 'grid-reverse-holo';
    tag.textContent = 'RH';

    el.appendChild(foil);
    el.appendChild(sweep);
    el.appendChild(tag);
  }

  return el;
}

/**
 * Render all collected cards to #card-grid.
 * Shows the most recent MAX_DISPLAY_CARDS entries, newest first.
 *
 * @param {Object[]} cards - engine.state.cards
 */
export function renderCardGrid(cards) {
  const grid    = document.getElementById('card-grid');
  const countEl = document.getElementById('collection-count');
  if (!grid) return;

  grid.innerHTML = '';

  const displayCards = cards.slice(-MAX_DISPLAY_CARDS).reverse();

  const fragment = document.createDocumentFragment();
  for (const card of displayCards) {
    fragment.appendChild(createCardElement(card));
  }
  grid.appendChild(fragment);

  if (countEl) {
    if (cards.length === 0) {
      countEl.textContent = '';
    } else if (cards.length > MAX_DISPLAY_CARDS) {
      countEl.textContent = `(${cards.length.toLocaleString()} total — showing last ${MAX_DISPLAY_CARDS})`;
    } else {
      countEl.textContent = `(${cards.length.toLocaleString()} cards)`;
    }
  }
}
