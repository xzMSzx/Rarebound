import { describe, it, expect, vi } from 'vitest';
import { composeRules, assertIsRule } from '../../engine/rules.js';

describe('engine/rules', () => {
  describe('composeRules', () => {
    it('should run rules in the correct sequential order', () => {
      // We want to test that the output of one rule becomes the input of the next.
      // Also, we'll track the order in which they were called.
      const order = [];

      const rule1 = vi.fn((state, engine) => {
        order.push(1);
        return { ...state, value: state.value + 1 };
      });

      const rule2 = vi.fn((state, engine) => {
        order.push(2);
        return { ...state, value: state.value * 2 };
      });

      const rule3 = vi.fn((state, engine) => {
        order.push(3);
        return { ...state, value: state.value - 3 };
      });

      const composed = composeRules(rule1, rule2, rule3);
      const mockEngine = {};
      const initialState = { value: 5 };

      const finalState = composed(initialState, mockEngine);

      // Initial 5
      // Rule 1: 5 + 1 = 6
      // Rule 2: 6 * 2 = 12
      // Rule 3: 12 - 3 = 9

      expect(order).toEqual([1, 2, 3]);
      expect(finalState).toEqual({ value: 9 });

      // Check that each rule was called with the correct arguments
      expect(rule1).toHaveBeenCalledWith(initialState, mockEngine);
      expect(rule2).toHaveBeenCalledWith({ value: 6 }, mockEngine);
      expect(rule3).toHaveBeenCalledWith({ value: 12 }, mockEngine);
    });

    it('should return the initial state if no rules are provided', () => {
      const composed = composeRules();
      const initialState = { value: 42 };
      expect(composed(initialState, {})).toBe(initialState);
    });
  });

  describe('assertIsRule', () => {
    it('should not throw if a function is provided', () => {
      expect(() => assertIsRule(() => {})).not.toThrow();
    });

    it('should throw if a non-function is provided', () => {
      expect(() => assertIsRule(null)).toThrow(TypeError);
      expect(() => assertIsRule(undefined)).toThrow(TypeError);
      expect(() => assertIsRule(42)).toThrow(TypeError);
      expect(() => assertIsRule('string')).toThrow(TypeError);
      expect(() => assertIsRule({})).toThrow(TypeError);
      expect(() => assertIsRule([])).toThrow(TypeError);
    });
  });
});
