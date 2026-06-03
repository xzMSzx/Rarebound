import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toggleWishlist, isWishlisted, getWishlist, addToWishlist, removeFromWishlist } from '../data/wishlistManager.js';
import { clearCardPoolCache } from '../data/cardPoolManager.js';

describe('wishlistManager', () => {
  beforeEach(() => {
    clearCardPoolCache();
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      clear: vi.fn(() => store.clear()),
    });
  });

  it('should start empty and toggle wishlist correctly', () => {
    const cardId = 'card1';

    // Initially not wishlisted
    expect(isWishlisted(cardId)).toBe(false);

    // Toggle to add
    const added = toggleWishlist(cardId);
    expect(added).toBe(true);
    expect(isWishlisted(cardId)).toBe(true);

    // Toggle to remove
    const removed = toggleWishlist(cardId);
    expect(removed).toBe(false);
    expect(isWishlisted(cardId)).toBe(false);
  });

  it('should handle malformed JSON gracefully', () => {
    localStorage.setItem('tcg_wishlist', 'invalid json');
    expect(isWishlisted('card1')).toBe(false);

    toggleWishlist('card1');
    expect(isWishlisted('card1')).toBe(true);
    expect(localStorage.getItem('tcg_wishlist')).toBe('["card1"]');
  });

  it('should return full wishlist', () => {
    toggleWishlist('card1');
    toggleWishlist('card2');

    const wishlist = getWishlist();
    expect(wishlist).toBeInstanceOf(Set);
    expect(wishlist.has('card1')).toBe(true);
    expect(wishlist.has('card2')).toBe(true);
    expect(wishlist.size).toBe(2);
  });

  it('should support explicit add and remove', () => {
     addToWishlist('card3');
     expect(isWishlisted('card3')).toBe(true);

     removeFromWishlist('card3');
     expect(isWishlisted('card3')).toBe(false);
  });
});
