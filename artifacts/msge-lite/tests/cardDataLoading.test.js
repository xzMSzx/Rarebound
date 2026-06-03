import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeCardData } from '../data/cardDataNormalizer.js';
import { fetchSetCards } from '../data/setLoader.js';
import { loadSet, getCachedSetCards, clearCardPoolCache } from '../data/cardPoolManager.js';

function installLocalStorage() {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    get length() { return store.size; },
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, value) => store.set(key, value)),
    removeItem: vi.fn((key) => store.delete(key)),
    key: vi.fn((index) => Array.from(store.keys())[index] || null),
    clear: vi.fn(() => store.clear()),
  });
  return store;
}

describe('card data loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installLocalStorage();
    clearCardPoolCache();
  });

  it('normalizes every image reference to HD before caching consumers see it', () => {
    const cards = normalizeCardData([
      { id: 'a', name: 'A', images: { small: 'small.png', large: 'large.png' } },
      { id: 'b', name: 'B', images: { large: 'only-large.png' } },
    ]);

    expect(cards[0].images.small).toBe('large.png');
    expect(cards[0].images.display).toBe('large.png');
    expect(cards[0].images.hires).toBe('large.png');
    expect(cards[1].images.small).toBe('only-large.png');
  });

  it('fetches a single static set JSON file without API query pagination', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 'sv3pt5-1', name: 'Bulbasaur', rarity: 'Common', images: { large: 'hires.png' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const cards = await fetchSetCards('sv3pt5');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/sv3pt5.json',
    );
    expect(fetchMock.mock.calls[0][0]).not.toContain('pageSize=');
    expect(cards[0].images.small).toBe('hires.png');
  });

  it('uses versioned persistent cache and removes stale blurry set caches', async () => {
    localStorage.setItem('rb_set_svtest', '{"raw":[]}');
    localStorage.setItem('rb_set_hd_svtest', '{"raw":[]}');

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: 'svtest-1', name: 'Common One', rarity: 'Common', images: { small: 'thumb.png', large: 'hires.png' } },
      ],
    })));

    await loadSet('svtest');
    const cached = JSON.parse(localStorage.getItem('rb_set_hd_v2_svtest'));

    expect(localStorage.getItem('rb_set_svtest')).toBeNull();
    expect(localStorage.getItem('rb_set_hd_svtest')).toBeNull();
    expect(cached.raw[0].images.small).toBe('hires.png');
    expect(getCachedSetCards('svtest')[0].images.small).toBe('hires.png');
  });
});

