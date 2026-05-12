import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReputation, addReputation, getRank, getAllRanks } from '../data/reputationManager.js';
import * as devAccess from '../data/devAccess.js';

vi.mock('../data/devAccess.js', () => ({
  isSandboxMode: vi.fn(),
}));

describe('reputationManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('addReputation', () => {
    it('returns current points if amount is undefined, null, 0 or negative', () => {
      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 50 }));
      expect(addReputation(undefined)).toBe(50);
      expect(addReputation(null)).toBe(50);
      expect(addReputation(0)).toBe(50);
      expect(addReputation(-10)).toBe(50);
      expect(localStorage.getItem('tcg_reputation')).toBe('{"points":50}');
    });

    it('returns current points if sandbox mode is active', () => {
      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 50 }));
      devAccess.isSandboxMode.mockReturnValue(true);
      expect(addReputation(10)).toBe(50);
      expect(localStorage.getItem('tcg_reputation')).toBe('{"points":50}');
    });

    it('adds reputation and saves to localStorage when not in sandbox mode', () => {
      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 50 }));
      devAccess.isSandboxMode.mockReturnValue(false);
      expect(addReputation(10)).toBe(60);
      expect(localStorage.getItem('tcg_reputation')).toBe('{"points":60}');
    });

    it('handles adding reputation when storage is empty', () => {
      devAccess.isSandboxMode.mockReturnValue(false);
      expect(addReputation(10)).toBe(10);
      expect(localStorage.getItem('tcg_reputation')).toBe('{"points":10}');
    });
  });

  describe('getReputation', () => {
    it('returns 0 if storage is empty', () => {
      expect(getReputation()).toBe(0);
    });

    it('returns current points from storage', () => {
      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 75 }));
      expect(getReputation()).toBe(75);
    });
  });

  describe('getRank', () => {
    it('returns the correct rank details based on points', () => {
      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 150 }));
      const rank = getRank();
      expect(rank.name).toBe('Collector');
      expect(rank.current).toBe(150);
      expect(rank.nextMin).toBe(400);
      expect(Math.round(rank.progressPct)).toBe(17); // (150 - 100) / (400 - 100) * 100 = 50 / 300 = 16.66%
      expect(rank.description).toBe('Your binder is taking shape. Vendors are starting to notice.');
    });

    it('handles max rank correctly', () => {
      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 15000 }));
      const rank = getRank();
      expect(rank.name).toBe('Legendary Collector');
      expect(rank.current).toBe(15000);
      expect(rank.nextMin).toBe(null);
      expect(rank.progressPct).toBe(100);
      expect(rank.description).toBe('The archive is complete. The legend endures.');
    });

    it('uses empty string for description if description is falsy', () => {
      // By modifying one of the ranks temporarily, we can hit the description || '' branch.
      const ranks = getAllRanks();
      const originalDesc = ranks[0].description;
      ranks[0].description = undefined;
      // Note: slice() creates a shallow copy, but modifying a property modifies the original object in the RANKS array.

      localStorage.setItem('tcg_reputation', JSON.stringify({ points: 0 }));
      const rank = getRank();
      expect(rank.description).toBe('');

      // Restore original description
      ranks[0].description = originalDesc;
    });
  });

  describe('getAllRanks', () => {
    it('returns all ranks', () => {
      const ranks = getAllRanks();
      expect(ranks.length).toBe(7);
      expect(ranks[0].name).toBe('Rookie Collector');
      expect(ranks[6].name).toBe('Legendary Collector');
    });
  });

  describe('load JSON parse error', () => {
    it('returns default points when localStorage has invalid JSON', () => {
      localStorage.setItem('tcg_reputation', '{ invalid json }');
      expect(getReputation()).toBe(0);
    });
  });
});
