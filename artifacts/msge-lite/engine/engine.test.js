import { describe, it, expect, vi } from 'vitest';
import { Engine } from './engine.js';
import { createInitialState } from './state.js';

describe('Engine Instantiation', () => {
  it('should initialize with a default seed close to Date.now()', () => {
    const beforeTime = Date.now();
    const engine = new Engine();
    const afterTime = Date.now();

    expect(engine.seed).toBeGreaterThanOrEqual(beforeTime);
    expect(engine.seed).toBeLessThanOrEqual(afterTime);
  });

  it('should initialize with an explicit seed', () => {
    const explicitSeed = 12345;
    const engine = new Engine(explicitSeed);

    expect(engine.seed).toBe(explicitSeed);
  });

  it('should initialize state correctly', () => {
    const engine = new Engine();
    const expectedInitialState = createInitialState();

    expect(engine.state).toEqual(expectedInitialState);
  });

  it('should initialize entities, rules, and eventLog as empty arrays', () => {
    const engine = new Engine();

    expect(engine.entities).toEqual([]);
    expect(engine.rules).toEqual([]);
    expect(engine.eventLog).toEqual([]);
  });
});
