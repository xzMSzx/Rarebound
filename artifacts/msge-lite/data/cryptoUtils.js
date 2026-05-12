/**
 * data/cryptoUtils.js
 *
 * Utility for cryptographically secure random number generation.
 */

export function secureRandom() {
  const array = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(array);
  return array[0] / (0xffffffff + 1);
}
