/**
 * ui/favoritesScreen.js — v1.5.1
 *
 * Favorite Collection — a curated personal showcase of cards the player
 * has marked with the heart icon. NOT a binder, NOT a stat panel —
 * a private gallery.
 *
 * Sort priority (default, no UI controls — keep it calm):
 *   1. Graded slabs first  (presence in AGS completed registry)
 *   2. Higher rarity tier
 *   3. Higher market value
 *
 * Derives entirely from `favoritesManager` × `collectionManager` ×
 * `cardPoolManager` × `agsSubmissionManager`. No duplicated state.
 */

import { getFavorites, removeFavorite } from '../data/favoritesManager.js';
import { getCollection } from '../data/collectionManager.js';
import { getCachedSetCards, getCachedSetCardsMap } from '../data/cardPoolManager.js';
import { getAllMarketValues, getMarketValue } from '../data/marketValue.js';
import { mapPokemonRarity } from '../data/rarityMapper.js';
import { getCompletedSlabs } from '../data/agsSubmissionManager.js';
import { tierLabel } from '../data/agsGradingEngine.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';
import { CARD_RENDER_TIERS } from './renderTiers.js';

const RARITY_LABELS = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
  doubleRare: 'Double Rare', ultraRare: 'Ultra Rare',
  illustrationRare: 'Illustration Rare',
  specialIllustrationRare: 'Special Illustration',
  hyperRare: 'Hyper Rare',
};

const RARITY_ORDER = [
  'common', 'uncommon', 'rare', 'doubleRare', 'ultraRare',
  'illustrationRare', 'specialIllustrationRare', 'hyperRare',
];

let _hooks = null;

export function openFavoritesScreen(hooks = {}) {
  _hooks = hooks;
  const screen = document.getElementById('favorites-screen');
  if (!screen) {
    console.error('[Favorites] open aborted — favorites-screen missing from DOM');
    return;
  }
  lockBodyScroll();
  renderFavoritesScreen();
  screen.style.display = 'flex';
  requestAnimationFrame(() => screen.classList.remove('hidden'));
}

export function closeFavoritesScreen() {
  const screen = document.getElementById('favorites-screen');
  if (!screen) return;
  screen.classList.add('hidden');
  setTimeout(() => { screen.style.display = 'none'; }, 180);
  unlockBodyScroll();
  document.dispatchEvent(new CustomEvent('favorites-screen-closed'));
}

function buildFavoriteRows() {
  const fav        = getFavorites();
  const collection = getCollection();
  const allValues  = getAllMarketValues();
  const completed  = getCompletedSlabs();

  // Map cardId → first matching graded slab (highest grade wins).
  const gradedByCard = new Map();
  for (const slab of completed) {
    const prior = gradedByCard.get(slab.cardId);
    if (!prior || (slab.grade?.average || 0) > (prior.grade?.average || 0)) {
      gradedByCard.set(slab.cardId, slab);
    }
  }

  const rows = [];
  for (const [setId, cards] of Object.entries(collection)) {
    // ⚡ Bolt: Using pre-computed Map lookup instead of O(N) Object.fromEntries(cached.map...) per set
    const cardMap = getCachedSetCardsMap(setId);
    for (const [cardId, entry] of Object.entries(cards)) {
      if (!fav.has(cardId)) continue;
      const apiCard = cardMap ? cardMap.get(cardId) : null;
      if (!apiCard) continue;
      const rarity = mapPokemonRarity(apiCard.rarity) || 'common';
      const value  = allValues[cardId] ?? getMarketValue(cardId, rarity);
      const slab   = gradedByCard.get(cardId) || null;
      rows.push({
        setId, cardId, apiCard, entry, rarity, value, slab,
        rarityIdx: RARITY_ORDER.indexOf(rarity),
      });
    }
  }

  rows.sort((a, b) => {
    if (!!b.slab !== !!a.slab) return b.slab ? 1 : -1;
    if (b.rarityIdx !== a.rarityIdx) return b.rarityIdx - a.rarityIdx;
    return b.value - a.value;
  });
  return rows;
}

function renderFavoritesScreen() {
  const screen = document.getElementById('favorites-screen');
  if (!screen) return;
  const rows = buildFavoriteRows();

  const empty = `
    <div class="favorites-empty">
      <div class="favorites-empty__mark">♡</div>
      <div class="favorites-empty__title">No archived favorites yet.</div>
      <div class="favorites-empty__body">
        Mark cards with the heart icon to build your personal showcase.
      </div>
    </div>
  `;

  const grid = `
    <div class="favorites-grid">
      ${rows.map(renderFavoriteTile).join('')}
    </div>
  `;

  screen.innerHTML = `
    <div class="screen-header favorites-screen-header">
      <button class="screen-back-btn" id="favorites-back-btn">← Back</button>
      <div class="screen-title-row">
        <div class="screen-title">Favorite Collection</div>
        <div class="screen-subtitle">Curated highlights from your archive.</div>
      </div>
      <div class="screen-spacer"></div>
    </div>
    <div class="favorites-body">
      ${rows.length === 0 ? empty : grid}
    </div>
  `;

  screen.querySelector('#favorites-back-btn')?.addEventListener('click', closeFavoritesScreen);

  screen.querySelectorAll('[data-fav-card]').forEach(tile => {
    tile.addEventListener('click', () => {
      const setId = tile.dataset.favSet;
      const cardId = tile.dataset.favCard;
      if (_hooks?.openCardDetail) _hooks.openCardDetail(setId, cardId);
    });
  });
}

function renderFavoriteTile(row) {
  const { setId, cardId, apiCard, rarity, value, slab } = row;
  const img = apiCard.images?.large || apiCard.images?.small || '';
  const slabBadge = slab
    ? `<div class="favorite-tile__slab">${slab.grade?.label || tierLabel(slab.grade?.tier?.id)}</div>`
    : '';
  const rarityLbl = RARITY_LABELS[rarity] || rarity;

  return `
    <button class="favorite-tile" data-fav-card="${cardId}" data-fav-set="${setId}" type="button" data-render-tier="${CARD_RENDER_TIERS.THUMBNAIL}">
      <div class="favorite-tile__art-wrap">
        ${img
          ? `<img class="favorite-tile__art" src="${img}" alt="${apiCard.name}" loading="lazy" decoding="async" />`
          : `<div class="favorite-tile__art favorite-tile__art--missing">${apiCard.name}</div>`}
        ${slabBadge}
      </div>
      <div class="favorite-tile__name">${apiCard.name}</div>
      <div class="favorite-tile__meta">
        <span class="favorite-tile__rarity">${rarityLbl}</span>
        <span class="favorite-tile__value">$${value.toFixed(2)}</span>
      </div>
    </button>
  `;
}

/** Convenience: re-render if favorites changes outside this screen. */
export function refreshFavoritesScreen() {
  const screen = document.getElementById('favorites-screen');
  if (screen && !screen.classList.contains('hidden')) renderFavoritesScreen();
}

// Expose remove for any future "remove from favorites" inline action.
export { removeFavorite };
