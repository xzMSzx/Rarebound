import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Engine } from './engine.js';
import { createInitialState } from './state.js';

describe('Engine', () => {
  describe('constructor', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should instantiate with a default seed using Date.now()', () => {
      const mockDate = new Date(2023, 1, 1).valueOf();
      vi.setSystemTime(mockDate);

      const engine = new Engine();

      expect(engine.seed).toBe(mockDate);
    });

    it('should instantiate with a provided custom seed', () => {
      const customSeed = 12345;
      const engine = new Engine(customSeed);

      expect(engine.seed).toBe(customSeed);
    });

    it('should initialize state, entities, rules, and eventLog correctly', () => {
      const engine = new Engine();

      const expectedInitialState = createInitialState();

      expect(engine.state).toEqual(expectedInitialState);
      expect(engine.entities).toEqual([]);
      expect(engine.rules).toEqual([]);
      expect(engine.eventLog).toEqual([]);
    });
  });
});
