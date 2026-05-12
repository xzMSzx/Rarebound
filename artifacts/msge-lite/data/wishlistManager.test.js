import { describe, it, expect, beforeEach } from 'vitest';
import {
  toggleWishlist,
  isWishlisted,
  getWishlist,
  addToWishlist,
  removeFromWishlist
} from './wishlistManager';

describe('wishlistManager', () => {
  beforeEach(() => {
    // Clear localStorage mock before each test
    localStorage.clear();
  });

  describe('load/save (via getWishlist)', () => {
    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('tcg_wishlist', 'invalid json');
      const wishlist = getWishlist();
      expect(wishlist.size).toBe(0);
    });

    it('should return empty set if no data in localStorage', () => {
      const wishlist = getWishlist();
      expect(wishlist.size).toBe(0);
    });
  });

  describe('addToWishlist / removeFromWishlist', () => {
    it('should add to wishlist', () => {
      addToWishlist('card_a');
      expect(isWishlisted('card_a')).toBe(true);
    });

    it('should remove from wishlist', () => {
      addToWishlist('card_b');
      expect(isWishlisted('card_b')).toBe(true);
      removeFromWishlist('card_b');
      expect(isWishlisted('card_b')).toBe(false);
    });
  });

  describe('toggleWishlist', () => {
    it('should add an item to the wishlist if it is not present', () => {
      expect(isWishlisted('card1')).toBe(false);

      const result = toggleWishlist('card1');

      expect(result).toBe(true);
      expect(isWishlisted('card1')).toBe(true);
    });

    it('should remove an item from the wishlist if it is already present', () => {
      // First, add it
      toggleWishlist('card2');
      expect(isWishlisted('card2')).toBe(true);

      // Now, toggle again to remove
      const result = toggleWishlist('card2');

      expect(result).toBe(false);
      expect(isWishlisted('card2')).toBe(false);
    });

    it('should handle multiple items correctly', () => {
      toggleWishlist('card3');
      toggleWishlist('card4');

      expect(isWishlisted('card3')).toBe(true);
      expect(isWishlisted('card4')).toBe(true);

      toggleWishlist('card3');

      expect(isWishlisted('card3')).toBe(false);
      expect(isWishlisted('card4')).toBe(true);
    });
  });
});
