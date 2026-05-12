import { describe, it, expect, beforeEach, vi } from 'vitest';

function stubStorage(initial = {}, throwingKeys = new Set()) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, value) => {
      if (throwingKeys.has(key)) throw new Error(`blocked write: ${key}`);
      store.set(key, value);
    }),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  });
  return store;
}

describe('request fulfillment transactions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubGlobal('window', {});
  });

  it('fulfills regular requests through one commit path', async () => {
    stubStorage({
      tcg_player_v2: JSON.stringify({ balance: 0, collection: {} }),
      tcg_collection_v2: JSON.stringify({ sv1: { c1: { count: 2, locked: false } } }),
      tcg_vendor_requests: JSON.stringify({
        pokemart: {
          lastRefresh: 1,
          requests: [{
            id: 'req1',
            vendorId: 'pokemart',
            criteria: { kind: 'set', setId: 'sv1', mode: 'duplicate' },
            quantity: 1,
            reward: 25,
            favorReward: 3,
          }],
        },
      }),
    });
    const { loadPlayerState } = await import('../state/playerState.js');
    const { fulfillVendorRequest } = await import('../data/requestFulfillmentManager.js');

    loadPlayerState();
    const result = fulfillVendorRequest('req1');

    expect(result.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('tcg_collection_v2')).sv1.c1.count).toBe(1);
    expect(JSON.parse(localStorage.getItem('tcg_vendor_requests')).pokemart.requests).toEqual([]);
    expect(JSON.parse(localStorage.getItem('tcg_player_v2')).balance).toBe(25);
    expect(JSON.parse(localStorage.getItem('tcg_favor')).pokemart).toBe(3);
    expect(JSON.parse(localStorage.getItem('tcg_stats')).requestsCompleted).toBe(1);
    expect(JSON.parse(localStorage.getItem('tcg_stats')).lifetimeRevenue).toBe(25);
  });

  it('fulfills emergency requests with their reputation reward', async () => {
    stubStorage({
      tcg_player_v2: JSON.stringify({ balance: 0, collection: {} }),
      tcg_collection_v2: JSON.stringify({ sv1: { c1: { count: 2, locked: false } } }),
      tcg_emergency_requests: JSON.stringify({
        pokemart: {
          refreshedAt: 1,
          request: {
            id: 'emerg_1',
            vendorId: 'pokemart',
            criteria: { kind: 'set', setId: 'sv1', mode: 'duplicate' },
            quantity: 1,
            reward: 12,
            favorReward: 1,
            repReward: 2,
          },
        },
      }),
    });
    const { loadPlayerState } = await import('../state/playerState.js');
    const { fulfillVendorRequest } = await import('../data/requestFulfillmentManager.js');

    loadPlayerState();
    const result = fulfillVendorRequest('emerg_1');

    expect(result.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('tcg_emergency_requests'))).toEqual({});
    expect(JSON.parse(localStorage.getItem('tcg_reputation')).points).toBe(2);
  });

  it('rolls back collection and request state when reward persistence fails', async () => {
    stubStorage({
      tcg_player_v2: JSON.stringify({ balance: 0, collection: {} }),
      tcg_collection_v2: JSON.stringify({ sv1: { c1: { count: 2, locked: false } } }),
      tcg_vendor_requests: JSON.stringify({
        pokemart: {
          lastRefresh: 1,
          requests: [{
            id: 'req1',
            vendorId: 'pokemart',
            criteria: { kind: 'set', setId: 'sv1', mode: 'duplicate' },
            quantity: 1,
            reward: 25,
            favorReward: 3,
          }],
        },
      }),
    }, new Set(['tcg_player_v2']));
    const { loadPlayerState } = await import('../state/playerState.js');
    const { fulfillVendorRequest } = await import('../data/requestFulfillmentManager.js');

    loadPlayerState();
    const result = fulfillVendorRequest('req1');

    expect(result).toEqual({ ok: false, reason: 'write-failed' });
    expect(JSON.parse(localStorage.getItem('tcg_collection_v2')).sv1.c1.count).toBe(2);
    expect(JSON.parse(localStorage.getItem('tcg_vendor_requests')).pokemart.requests).toHaveLength(1);
  });

  it('returns insufficient without mutating when inventory changed after render', async () => {
    stubStorage({
      tcg_player_v2: JSON.stringify({ balance: 0, collection: {} }),
      tcg_collection_v2: JSON.stringify({ sv1: { c1: { count: 1, locked: false } } }),
      tcg_vendor_requests: JSON.stringify({
        pokemart: {
          lastRefresh: 1,
          requests: [{
            id: 'req1',
            vendorId: 'pokemart',
            criteria: { kind: 'set', setId: 'sv1', mode: 'duplicate' },
            quantity: 1,
            reward: 25,
            favorReward: 3,
          }],
        },
      }),
    });
    const { loadPlayerState } = await import('../state/playerState.js');
    const { fulfillVendorRequest } = await import('../data/requestFulfillmentManager.js');

    loadPlayerState();
    expect(fulfillVendorRequest('req1')).toEqual({ ok: false, reason: 'insufficient' });
    expect(JSON.parse(localStorage.getItem('tcg_collection_v2')).sv1.c1.count).toBe(1);
  });
});
