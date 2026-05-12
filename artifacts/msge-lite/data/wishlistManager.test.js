import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as wishlistManager from './wishlistManager.js';

describe('wishlistManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('load / getWishlist', () => {
    it('returns an empty Set when localStorage has malformed JSON', () => {
      localStorage.setItem('tcg_wishlist', '{ bad json }');
      const set = wishlistManager.getWishlist();
      expect(set).toBeInstanceOf(Set);
      expect(set.size).toBe(0);
    });

    it('returns an empty Set when localStorage is empty', () => {
      const set = wishlistManager.getWishlist();
      expect(set).toBeInstanceOf(Set);
      expect(set.size).toBe(0);
    });

    it('returns a Set with values when localStorage has valid JSON array', () => {
      localStorage.setItem('tcg_wishlist', JSON.stringify(['card1', 'card2']));
      const set = wishlistManager.getWishlist();
      expect(set).toBeInstanceOf(Set);
      expect(set.size).toBe(2);
      expect(set.has('card1')).toBe(true);
      expect(set.has('card2')).toBe(true);
    });
  });

  describe('isWishlisted', () => {
    it('returns true if card is in wishlist', () => {
      localStorage.setItem('tcg_wishlist', JSON.stringify(['card1']));
      expect(wishlistManager.isWishlisted('card1')).toBe(true);
    });

    it('returns false if card is not in wishlist', () => {
      localStorage.setItem('tcg_wishlist', JSON.stringify(['card1']));
      expect(wishlistManager.isWishlisted('card2')).toBe(false);
    });
  });

  describe('addToWishlist', () => {
    it('adds a card to the wishlist and persists it', () => {
      wishlistManager.addToWishlist('card1');
      const set = wishlistManager.getWishlist();
      expect(set.has('card1')).toBe(true);
      expect(localStorage.getItem('tcg_wishlist')).toBe(JSON.stringify(['card1']));
    });

    it('does not duplicate cards in the wishlist', () => {
      wishlistManager.addToWishlist('card1');
      wishlistManager.addToWishlist('card1');
      const set = wishlistManager.getWishlist();
      expect(set.size).toBe(1);
    });
  });

  describe('removeFromWishlist', () => {
    it('removes a card from the wishlist and persists it', () => {
      localStorage.setItem('tcg_wishlist', JSON.stringify(['card1', 'card2']));
      wishlistManager.removeFromWishlist('card1');
      const set = wishlistManager.getWishlist();
      expect(set.has('card1')).toBe(false);
      expect(set.has('card2')).toBe(true);
      expect(localStorage.getItem('tcg_wishlist')).toBe(JSON.stringify(['card2']));
    });
  });

  describe('toggleWishlist', () => {
    it('adds a card if it is not in the wishlist', () => {
      const result = wishlistManager.toggleWishlist('card1');
      expect(result).toBe(true);
      expect(wishlistManager.isWishlisted('card1')).toBe(true);
    });

    it('removes a card if it is already in the wishlist', () => {
      localStorage.setItem('tcg_wishlist', JSON.stringify(['card1']));
      const result = wishlistManager.toggleWishlist('card1');
      expect(result).toBe(false);
      expect(wishlistManager.isWishlisted('card1')).toBe(false);
    });
  });
});
