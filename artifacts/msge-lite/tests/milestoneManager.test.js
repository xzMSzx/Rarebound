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

describe('milestone reward ordering', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubGlobal('window', {});
  });

  it('exposes ready milestone rewards without marking them claimed', async () => {
    stubStorage({
      tcg_stats: JSON.stringify({ packsOpened: 10 }),
      tcg_milestones: JSON.stringify({ claimed: [] }),
    });
    const { getReadyMilestoneRewards, getClaimedMilestones } = await import('../data/milestoneManager.js');

    const ready = getReadyMilestoneRewards();

    expect(ready.map(m => m.id)).toContain('packs10');
    expect(getClaimedMilestones()).toEqual([]);
  });

  it('rolls back rewards if milestone claim persistence fails', async () => {
    stubStorage({
      tcg_stats: JSON.stringify({ packsOpened: 10 }),
      tcg_milestones: JSON.stringify({ claimed: [] }),
      tcg_player_v2: JSON.stringify({ balance: 0, collection: {} }),
    }, new Set(['tcg_milestones']));
    const { loadPlayerState } = await import('../state/playerState.js');
    const { addBalance } = await import('../state/playerState.js');
    const { withLocalStorageRollback } = await import('../data/localStorageTransaction.js');
    const { getReadyMilestoneRewards, markMilestonesClaimed } = await import('../data/milestoneManager.js');

    loadPlayerState();
    expect(() => withLocalStorageRollback(['tcg_milestones', 'tcg_player_v2'], () => {
      const ready = getReadyMilestoneRewards();
      for (const m of ready) addBalance(m.rewardCash || 0);
      markMilestonesClaimed(ready.map(m => m.id));
    })).toThrow('blocked write: tcg_milestones');

    expect(JSON.parse(localStorage.getItem('tcg_player_v2')).balance).toBe(0);
    expect(JSON.parse(localStorage.getItem('tcg_milestones')).claimed).toEqual([]);
  });
});
