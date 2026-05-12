import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRank, addReputation, getReputation, getAllRanks } from '../data/reputationManager.js';
import * as devAccess from '../data/devAccess.js';

// Mock devAccess
vi.mock('../data/devAccess.js', () => ({
  isSandboxMode: vi.fn(() => false)
}));

describe('reputationManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(devAccess.isSandboxMode).mockReturnValue(false);
  });

  describe('getRank', () => {
    it('should return initial rank details when points are 0', () => {
      const rank = getRank();
      expect(rank.name).toBe('Rookie Collector');
      expect(rank.description).toBe('Every great collection starts somewhere. Yours begins here.');
      expect(rank.current).toBe(0);
      expect(rank.nextMin).toBe(100);
      expect(rank.progressPct).toBe(0);
    });

    it('should return correct progress percentage halfway to next rank', () => {
      addReputation(50);
      const rank = getRank();
      expect(rank.name).toBe('Rookie Collector');
      expect(rank.current).toBe(50);
      expect(rank.nextMin).toBe(100);
      expect(rank.progressPct).toBe(50);
    });

    it('should advance to next rank when threshold is met', () => {
      addReputation(100);
      const rank = getRank();
      expect(rank.name).toBe('Collector');
      expect(rank.current).toBe(100);
      expect(rank.nextMin).toBe(400);
      expect(rank.progressPct).toBe(0);
    });

    it('should cap progress percentage at 100% when at max rank', () => {
      addReputation(15000);
      const rank = getRank();
      expect(rank.name).toBe('Legendary Collector');
      expect(rank.current).toBe(15000);
      expect(rank.nextMin).toBeNull();
      expect(rank.progressPct).toBe(100);
    });
  });

  describe('getAllRanks', () => {
    it('should return all 7 ranks', () => {
      const ranks = getAllRanks();
      expect(ranks.length).toBe(7);
      expect(ranks[0].name).toBe('Rookie Collector');
    });
  });

  describe('addReputation', () => {
    it('should not add negative amount', () => {
      addReputation(-100);
      expect(getReputation()).toBe(0);
    });

    it('should return current reputation if amount is not provided', () => {
      expect(addReputation()).toBe(0);
    });

    it('should not add reputation if sandbox mode is true', () => {
      vi.mocked(devAccess.isSandboxMode).mockReturnValue(true);
      addReputation(100);
      expect(getReputation()).toBe(0);
    });
  });

  describe('load fallback', () => {
    it('should catch error on malformed json and return points 0', () => {
      localStorage.setItem('tcg_reputation', '{malformed');
      expect(getReputation()).toBe(0);
    });
  });
});
