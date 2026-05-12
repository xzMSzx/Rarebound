import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { addReputation, getReputation, getRank } from './reputationManager.js';
import * as devAccess from './devAccess.js';

describe('Reputation Manager', () => {
  const STORAGE_KEY = 'tcg_reputation';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset any mocks
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addReputation', () => {
    it('should return current reputation when amount is 0 or falsy', () => {
      expect(addReputation(0)).toBe(0);
      expect(addReputation(null)).toBe(0);
      expect(addReputation(undefined)).toBe(0);
    });

    it('should return current reputation when amount is negative', () => {
      // Set initial reputation
      addReputation(100);
      expect(addReputation(-10)).toBe(100);
    });

    it('should add positive amount to reputation', () => {
      expect(addReputation(50)).toBe(50);
      expect(addReputation(25)).toBe(75);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.points).toBe(75);
    });

    it('should not add reputation when in sandbox mode', () => {
      // Mock isSandboxMode to return true
      vi.spyOn(devAccess, 'isSandboxMode').mockReturnValue(true);

      // Start with 0
      expect(getReputation()).toBe(0);

      // Attempt to add
      expect(addReputation(100)).toBe(0);

      // Verify nothing was saved
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.getItem to throw
      const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      // Should fall back to 0 and add
      expect(addReputation(50)).toBe(50);

      getSpy.mockRestore();
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      // Set invalid JSON
      localStorage.setItem(STORAGE_KEY, '{ invalid json');

      // Should fall back to 0 and add
      expect(addReputation(20)).toBe(20);
    });
  });

  describe('getRank', () => {
    it('should return correct rank info for starting reputation', () => {
      const rank = getRank();
      expect(rank.name).toBe('Rookie Collector');
      expect(rank.current).toBe(0);
      expect(rank.nextMin).toBe(100);
      expect(rank.progressPct).toBe(0);
    });

    it('should return correct rank info after adding reputation', () => {
      addReputation(150); // Reaches 'Collector'
      const rank = getRank();
      expect(rank.name).toBe('Collector');
      expect(rank.current).toBe(150);
      expect(rank.nextMin).toBe(400);
      // Progress from 100 to 400: (150-100) / (400-100) * 100 = 50 / 300 * 100 = 16.66%
      expect(rank.progressPct).toBeCloseTo(16.66, 1);
    });

    it('should cap progress at 100% for highest rank', () => {
      addReputation(15000); // Reaches 'Legendary Collector' (min 10000)
      const rank = getRank();
      expect(rank.name).toBe('Legendary Collector');
      expect(rank.current).toBe(15000);
      expect(rank.nextMin).toBeNull();
      expect(rank.progressPct).toBe(100);
    });
  });
});
