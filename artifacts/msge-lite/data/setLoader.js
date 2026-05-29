/**
 * data/setLoader.js
 * Loads static Pokemon TCG set JSON from the public pokemon-tcg-data mirror.
 *
 * This avoids the live Pokemon TCG API entirely: no pagination, API keys,
 * throttling, query builders, retry backoff, or API-specific response wrapper.
 */

import { getApiId } from './setRegistry.js';
import { normalizeCardData } from './cardDataNormalizer.js';

const DATA_BASE = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en';
const FETCH_TIMEOUT_MS = 12_000;

/**
 * @param {string} setId  e.g. 'swsh7', 'sv3pt5', 'sv4'
 * @returns {Promise<Object[]>} normalized card objects with HD image aliases
 */
export async function fetchSetCards(setId) {
  const filename = getApiId(setId);
  const url = `${DATA_BASE}/${encodeURIComponent(filename)}.json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Static set fetch failed: ${response.status} ${response.statusText}`);
    }

    let json;
    try {
      json = await response.json();
    } catch (err) {
      throw new Error(`Static set JSON malformed for ${setId}: ${err.message}`);
    }

    const cards = normalizeCardData(json);
    if (cards.length === 0) {
      throw new Error(`Static set ${setId} contained no usable cards`);
    }

    return cards;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Static set fetch timed out for ${setId}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

