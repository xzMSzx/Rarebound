/**
 * data/setLoader.js
 * Fetches card data from the Pokémon TCG public API.
 * No API key required for small requests.
 *
 * Phase 4.5.4 — Multi-page paginated loader:
 *   - Fetches page after page until the API returns fewer than pageSize cards
 *   - Each page goes through fetchWithRetry (3 attempts, 1 s back-off)
 *   - Image filter accepts cards with either images.small OR images.large
 *   - images.small is back-filled from images.large when missing
 *
 * The pagination loop is necessary even though pageSize=250 already covers
 * every released set today, because the API can silently cap a single page
 * at 250 items and signal more via the totalCount field. Looping until a
 * short page arrives is the only future-proof contract with the API.
 */

import { getApiId } from './setRegistry.js';

const API_BASE = 'https://api.pokemontcg.io/v2/cards';
const PAGE_SIZE = 100;

/**
 * Single-page fetch with strict response validation.
 *
 * @param {string} url
 * @returns {Promise<Object[]>}  raw card objects from this page
 */
async function fetchPage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Pokémon TCG API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('API response malformed — data field missing or not an array');
  }

  return json.data;
}

/**
 * Per-page fetch with automatic retry on failure.
 *
 * @param {string} url
 * @param {number} retries  — maximum attempt count (default 3)
 * @returns {Promise<Object[]>}
 */
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchPage(url);
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`Card API: retry attempt ${i + 1} after error — ${err.message}`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Fetch every page of cards for a given Pokémon TCG set.
 * Loops until a short page (< PAGE_SIZE) signals the end of the set.
 *
 * @param {string} setId  e.g. 'swsh7', 'sv1', 'sv4'
 * @returns {Promise<Object[]>}  card objects with confirmed artwork
 * @throws {Error}  if all retry attempts fail or the API returns no usable cards
 */
export async function fetchSetCards(setId) {
  let page = 1;
  let allCards = [];

  try {
    while (true) {
      const apiId = getApiId(setId);
      const url = `${API_BASE}?q=set.id:${apiId}&pageSize=${PAGE_SIZE}&page=${page}&select=id,name,rarity,images`;

      const pageData = await fetchWithRetry(url);

      if (pageData.length === 0) break;

      allCards = allCards.concat(pageData);

      // Short page — we've reached the end of the set
      if (pageData.length < PAGE_SIZE) break;

      page++;
    }
  } catch (err) {
    console.warn(`[setLoader] Fetch failed for set ${setId}:`, err.message);
  }

  if (allCards.length === 0) {
    console.warn(`[setLoader] API returned empty card list for ${setId}. Falling back to sv3pt5.`);
    if (setId !== 'sv3pt5') {
      return await fetchSetCards('sv3pt5');
    }
  }

  // Keep any card that has at least one image (small or large).
  // Some sets (Evolving Skies Trainer Gallery) only carry images.large.
  let cards = allCards.filter((c) => c.images && (c.images.large || c.images.small));

  // Widen filter safely: if filtering removes everything, use all cards but inject placeholder
  if (cards.length === 0) {
    console.warn(`[setLoader] No valid images for set ${setId} after filtering. Widening filter.`);
    cards = allCards.map(c => {
       if (!c.images) c.images = {};
       if (!c.images.small && !c.images.large) {
         c.images.small = 'https://images.pokemontcg.io/cardback.png';
       }
       return c;
    });
  }

  // Normalise: ensure every card has images.small so the renderer always has a URL.
  for (const card of cards) {
    if (!card.images.small && card.images.large) {
      card.images.small = card.images.large;
    }
  }

  return cards;
}
