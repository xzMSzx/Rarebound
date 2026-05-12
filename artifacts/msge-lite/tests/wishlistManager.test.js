import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWishlist,
  isWishlisted,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist
} from '../data/wishlistManager.js';

describe('wishlistManager', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.restoreAllMocks();
    // Clear localStorage mock
    localStorage.clear();
  });

  describe('load / getWishlist', () => {
    it('handles malformed string gracefully', () => {
      // Mock localStorage to return a malformed JSON string
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{ malformed: json ');

      const result = getWishlist();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(getItemSpy).toHaveBeenCalledWith('tcg_wishlist');
    });

    it('handles null gracefully', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      const result = getWishlist();
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(getItemSpy).toHaveBeenCalledWith('tcg_wishlist');
    });

    it('loads valid JSON correctly', () => {
      const validData = JSON.stringify(['card-1', 'card-2']);
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(validData);

      const result = getWishlist();
      expect(result.size).toBe(2);
      expect(result.has('card-1')).toBe(true);
      expect(result.has('card-2')).toBe(true);
    });
  });

  describe('addToWishlist', () => {
    it('adds a card and saves to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      addToWishlist('new-card');

      // It should have been saved
      expect(setItemSpy).toHaveBeenCalledWith('tcg_wishlist', JSON.stringify(['new-card']));
    });
  });

  describe('removeFromWishlist', () => {
    it('removes a card and saves to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['card-1', 'card-2']));

      removeFromWishlist('card-1');

      expect(setItemSpy).toHaveBeenCalledWith('tcg_wishlist', JSON.stringify(['card-2']));
    });
  });

  describe('isWishlisted', () => {
    it('returns true if the card is in the wishlist', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['card-1']));
      expect(isWishlisted('card-1')).toBe(true);
    });

    it('returns false if the card is not in the wishlist', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['card-1']));
      expect(isWishlisted('card-2')).toBe(false);
    });
  });

  describe('toggleWishlist', () => {
    it('adds the card if it is not in the wishlist and returns true', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['card-1']));

      const result = toggleWishlist('card-2');

      expect(result).toBe(true);
      expect(setItemSpy).toHaveBeenCalledWith('tcg_wishlist', JSON.stringify(['card-1', 'card-2']));
    });

    it('removes the card if it is in the wishlist and returns false', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['card-1', 'card-2']));

      const result = toggleWishlist('card-2');

      expect(result).toBe(false);
      expect(setItemSpy).toHaveBeenCalledWith('tcg_wishlist', JSON.stringify(['card-1']));
    });
  });
});
