/**
 * engine/rules.js
 * Rules system — the contract and utilities for simulation rules.
 *
 * A rule is a pure function with the signature:
 *   function rule(state, engine) → state
 *
 * Rules must:
 *   - Accept the current state and the engine instance
 *   - Return an updated state (treat input as immutable)
 *   - Never interact with the DOM or UI layer
 *   - Log events via engine.eventLog.push(message)
 */

/**
 * Compose multiple rules into a single rule that runs them in order.
 * @param {...Function} rules
 * @returns {Function}
 */
export function composeRules(...rules) {
  return function composedRule(state, engine) {
    return rules.reduce((currentState, rule) => rule(currentState, engine), state);
  };
}

/**
 * Validate that a value is a proper rule function.
 * Throws if the check fails — used during engine.addRule().
 * @param {Function} rule
 */
export function assertIsRule(rule) {
  if (typeof rule !== 'function') {
    throw new TypeError(`Rule must be a function, got: ${typeof rule}`);
  }
}
