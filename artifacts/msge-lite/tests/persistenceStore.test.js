import { describe, it, expect, beforeEach, vi } from 'vitest';

function stubStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, value) => store.set(key, value)),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  });
  return store;
}

describe('critical persistence recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubGlobal('window', {});
  });

  it('quarantines corrupted collection payloads before returning fallback state', async () => {
    const store = stubStorage({ tcg_collection_v2: '{broken' });
    const { getCollection } = await import('../data/collectionManager.js');

    expect(getCollection()).toEqual({});
    expect([...store.keys()].some(key => key.startsWith('tcg_corrupt_backup:tcg_collection_v2:'))).toBe(true);
  });

  it('quarantines corrupted wishlist payloads before returning an empty set', async () => {
    const store = stubStorage({ tcg_wishlist: '{broken' });
    const { getWishlist } = await import('../data/wishlistManager.js');

    expect(getWishlist()).toEqual(new Set());
    expect([...store.keys()].some(key => key.startsWith('tcg_corrupt_backup:tcg_wishlist:'))).toBe(true);
  });

  it('quarantines invalid player state shape during load', async () => {
    const store = stubStorage({ tcg_player_v2: '[]' });
    const { loadPlayerState, getBalance } = await import('../state/playerState.js');

    loadPlayerState();

    expect(getBalance()).toBe(120);
    expect([...store.keys()].some(key => key.startsWith('tcg_corrupt_backup:tcg_player_v2:'))).toBe(true);
  });
});
