/**
 * engine/engine.js
 * Core Engine class — the central coordinator for all simulations.
 *
 * The engine is completely UI-agnostic. It owns:
 *   - simulation state
 *   - registered rule pipeline
 *   - entity list
 *   - event log
 *
 * The UI layer reads engine.state and engine.eventLog after each step.
 */

import { createInitialState } from './state.js';
import { assertIsRule } from './rules.js';
import { setSeed } from './rng.js';

export class Engine {
  /**
   * @param {number} [seed=Date.now()] Optional seed. Omit for random simulation;
   *   supply a fixed integer (e.g. 12345) for deterministic/reproducible runs.
   */
  constructor(seed = Date.now()) {
    /** @type {number} Seed for deterministic RNG — set before initializeSimulation */
    this.seed = seed;

    /** @type {Object} Current simulation state */
    this.state = createInitialState();

    /** @type {Array} Flat list of all entity objects created during the simulation */
    this.entities = [];

    /** @type {Function[]} Ordered pipeline of rule functions */
    this.rules = [];

    /** @type {string[]} Append-only log of simulation events */
    this.eventLog = [];
  }

  /**
   * Create a fresh simulation state and seed the RNG.
   * Call this before running any steps.
   */
  initializeSimulation() {
    setSeed(this.seed);
    this.state = createInitialState();
    this.entities = [];
    this.eventLog = [];
    this.eventLog.push('Simulation seed: ' + this.seed);
  }

  /**
   * Register a rule function to be executed on every simulation step.
   * Rules run in the order they are added.
   * @param {Function} rule  function(state, engine) → state
   */
  addRule(rule) {
    assertIsRule(rule);
    this.rules.push(rule);
  }

  /**
   * Run one simulation step by passing state through every rule in order.
   * Each rule receives the state returned by the previous rule.
   */
  stepSimulation() {
    let state = this.state;
    for (const rule of this.rules) {
      state = rule(state, this);
    }
    this.state = state;
  }

  /**
   * Run stepSimulation n times in a tight loop.
   * All events are still logged; the UI should refresh once after this returns.
   * @param {number} n  Number of steps to run
   */
  runBatchSimulation(n) {
    this.eventLog.push(`--- Batch run: ${n} packs ---`);
    for (let i = 0; i < n; i++) {
      this.stepSimulation();
    }
    this.eventLog.push(`--- Batch complete ---`);
  }

  /**
   * Reset state, entities, and event log back to initial values.
   * The registered rules are kept so the simulation is ready to run again.
   */
  resetSimulation() {
    // Generate a fresh random seed on each reset so results are never repeated
    this.seed = Date.now();
    setSeed(this.seed);
    this.state = createInitialState();
    this.entities = [];
    this.eventLog = [];
    this.eventLog.push('Simulation reset');
    this.eventLog.push('Simulation seed: ' + this.seed);
  }

  /**
   * Run a large Monte Carlo simulation for probability analysis.
   *
   * The simulation runs entirely in memory — the UI is NOT updated per pack,
   * making it suitable for 10,000+ pack stress tests.
   * After the run, the event log is replaced with a concise probability report.
   *
   * @param {number} packCount  Number of packs to simulate (e.g. 10000)
   */
  runMonteCarloSimulation(packCount) {
    // Fresh state and seed for the Monte Carlo run
    this.seed = Date.now();
    setSeed(this.seed);
    this.state = createInitialState();
    this.entities = [];
    this.eventLog = [];

    // Run all packs — rules log to eventLog internally but we discard it after
    for (let i = 0; i < packCount; i++) {
      this.stepSimulation();
    }

    // Discard the per-pack log noise; replace with the summary report only
    this.eventLog = [];

    const { rarityStats, slotStats, cards, packsOpened } = this.state;
    const totalCards = cards.length;

    // Helper: format a percentage to two decimal places
    const pct = (count) => ((count / totalCards) * 100).toFixed(2);

    // Theoretical expected rates derived from the slot probability tables:
    //   Slots 1–3 → always Common (3 cards)
    //   Slot 4    → Rare 80%, Epic 18%, Legendary 2%
    //   Slot 5    → Common 90%, Rare 8%, Epic 1.8%, Legendary 0.2%
    //   Per pack:  Common ≈78%, Rare ≈17.6%, Epic ≈3.96%, Legendary ≈0.44%
    //   (Pity inflates Epic slightly in practice.)
    const EXPECTED = { common: '78.00', rare: '17.60', epic: '3.96', legendary: '0.44' };

    this.eventLog.push('=== MONTE CARLO SIMULATION COMPLETE ===');
    this.eventLog.push(`Packs simulated:  ${packsOpened.toLocaleString()}`);
    this.eventLog.push(`Cards generated:  ${totalCards.toLocaleString()}`);
    this.eventLog.push(`Simulation seed:  ${this.seed}`);
    this.eventLog.push('');
    this.eventLog.push('--- Rarity Distribution ---');
    this.eventLog.push(`Expected Legendary Rate: ${EXPECTED.legendary}%`);
    this.eventLog.push(`Actual   Legendary Rate: ${pct(rarityStats.legendary)}%`);
    this.eventLog.push('');
    this.eventLog.push(`Expected Epic Rate:      ${EXPECTED.epic}%`);
    this.eventLog.push(`Actual   Epic Rate:      ${pct(rarityStats.epic)}%`);
    this.eventLog.push('');
    this.eventLog.push(`Expected Rare Rate:      ${EXPECTED.rare}%`);
    this.eventLog.push(`Actual   Rare Rate:      ${pct(rarityStats.rare)}%`);
    this.eventLog.push('');
    this.eventLog.push(`Expected Common Rate:    ${EXPECTED.common}%`);
    this.eventLog.push(`Actual   Common Rate:    ${pct(rarityStats.common)}%`);
    this.eventLog.push('');
    this.eventLog.push('--- Hit Distribution by Slot ---');
    for (let s = 1; s <= 5; s++) {
      const ss = slotStats['slot' + s];
      this.eventLog.push(
        `  Slot ${s}: Epic ${ss.epic.toLocaleString()} | Legendary ${ss.legendary.toLocaleString()}`
      );
    }
    this.eventLog.push('');
    this.eventLog.push('Validation: Slots 1-3 should show zero hits.');
    this.eventLog.push('Slot 4 (Rare Slot) drives Epic; Slot 5 (Hit Slot) drives Legendary.');
  }

  /**
   * Store an entity in the engine's entity list.
   * @param {Object} entity  e.g. { id, type, data }
   */
  addEntity(entity) {
    this.entities.push(entity);
  }
}
