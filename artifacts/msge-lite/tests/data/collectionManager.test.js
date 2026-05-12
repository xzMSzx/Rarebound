import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCollection } from '../../data/collectionManager.js';

describe('collectionManager.js', () => {
  const STORAGE_KEY = 'tcg_collection_v2';

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCollection', () => {
    it('returns an empty object if no data exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const collection = getCollection();

      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(collection).toEqual({});
    });

    it('returns parsed JSON when valid data exists', () => {
      const mockData = { 'set1': { 'card1': { count: 1, locked: true } } };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockData));

      const collection = getCollection();

      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(collection).toEqual(mockData);
    });

    it('returns an empty object if JSON parsing throws an error (invalid JSON)', () => {
      // Return invalid JSON string to trigger the catch block in getCollection
      vi.mocked(localStorage.getItem).mockReturnValue('{ invalid json: true');

      const collection = getCollection();

      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(collection).toEqual({});
    });
  });
});
