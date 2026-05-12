import { describe, it, expect } from 'vitest';
import { weightedRandom } from './rng.js';

describe('weightedRandom', () => {
  it('throws an error if options is an empty array', () => {
    expect(() => weightedRandom([])).toThrowError('weightedRandom: options array must not be empty');
  });

  it('throws an error if options is null', () => {
    expect(() => weightedRandom(null)).toThrowError('weightedRandom: options array must not be empty');
  });

  it('throws an error if options is undefined', () => {
    expect(() => weightedRandom(undefined)).toThrowError('weightedRandom: options array must not be empty');
  });
});
