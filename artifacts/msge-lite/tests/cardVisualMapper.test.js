import { describe, expect, it, vi } from 'vitest';
import { getCardVisualProfile } from '../data/cardVisualMapper.js';

describe('card visual profile mapping', () => {
  it('maps Greninja ex SIR to Scarlet & Violet special illustration metadata', () => {
    expect(getCardVisualProfile({
      name: 'Greninja ex',
      rarity: 'Special Illustration Rare',
      set: { name: 'Twilight Masquerade' },
    })).toEqual({ era: 'sv', rarity: 'sir' });
  });

  it('maps supported Sword & Shield set names to swsh era', () => {
    expect(getCardVisualProfile({
      rarity: 'Rare',
      set: { name: 'Evolving Skies' },
    }).era).toBe('swsh');

    expect(getCardVisualProfile({
      rarity: 'Rare',
      set: { name: 'Lost Origin' },
    }).era).toBe('swsh');
  });

  it('maps common rarity to common visual rarity', () => {
    expect(getCardVisualProfile({
      rarity: 'Common',
      set: { name: 'Scarlet & Violet' },
    }).rarity).toBe('common');
  });

  it('falls back safely for unknown rarity values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getCardVisualProfile({
      rarity: 'Rainbow Snack Rare',
      set: { name: 'Scarlet & Violet' },
    })).toEqual({ era: 'sv', rarity: 'common' });
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
