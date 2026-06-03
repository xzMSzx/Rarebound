import { describe, it, expect, beforeEach, vi } from 'vitest';
import { submitForGrading } from '../data/agsSubmissionManager.js';
import { canCompleteRequest, findEligibleCards } from '../data/requestManager.js';
import { clearCardPoolCache } from '../data/cardPoolManager.js';

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

describe('AGS persistence safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('window', {});
    stubStorage();
    clearCardPoolCache();
  });

  it('does not report a queued submission when AGS storage fails', () => {
    stubStorage({}, new Set(['tcg_ags_submissions']));

    const result = submitForGrading({
      setId: 'sv1',
      cardId: 'sv1-001',
      copyN: 1,
      tier: 'standard',
      rarity: 'doubleRare',
    });

    expect(result).toBeNull();
  });

  it('blocks sales when every owned copy is locked by AGS', async () => {
    const { sellCard } = await import('../data/sellingManager.js');
    stubStorage({
      tcg_collection_v2: JSON.stringify({
        sv1: { 'sv1-001': { count: 1, locked: false } },
      }),
      tcg_ags_submissions: JSON.stringify({
        active: [],
        completed: [{ uid: 'sv1:sv1-001:c1', setId: 'sv1', cardId: 'sv1-001', copyN: 1 }],
        nextSerial: 1001,
      }),
    });

    expect(() => sellCard('sv1', 'sv1-001', 'doubleRare', 'pokemart', { force: true }))
      .toThrow('NO_RAW_COPY_AVAILABLE');
  });

  it('keeps AGS-locked copies out of duplicate request availability', () => {
    const request = {
      id: 'req1',
      criteria: { kind: 'set', setId: 'sv1', mode: 'duplicate' },
      quantity: 1,
    };
    stubStorage({
      tcg_collection_v2: JSON.stringify({
        sv1: { 'sv1-001': { count: 2, locked: false } },
      }),
      tcg_ags_submissions: JSON.stringify({
        active: [],
        completed: [{ uid: 'sv1:sv1-001:c1', setId: 'sv1', cardId: 'sv1-001', copyN: 1 }],
        nextSerial: 1001,
      }),
    });

    expect(findEligibleCards(request)).toEqual([]);
    expect(canCompleteRequest(request)).toBe(false);
  });
});
