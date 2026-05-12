import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setSeed, getSeed } from './rng.js';

describe('RNG setSeed', () => {
  test('should update the seed value', () => {
    setSeed(999);
    assert.strictEqual(getSeed(), 999);
  });

  test('should treat seed as unsigned 32-bit integer', () => {
    setSeed(-1);
    assert.strictEqual(getSeed(), 4294967295);

    setSeed(4294967296);
    assert.strictEqual(getSeed(), 0);

    setSeed(0.5);
    assert.strictEqual(getSeed(), 0);
  });
});
