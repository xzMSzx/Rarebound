/**
 * ui/uiRenderer.js
 * UI Renderer — reads engine state and updates the DOM.
 *
 * This module is the ONLY file allowed to touch the DOM.
 * The engine knows nothing about this file.
 */

// ─── DOM references (resolved once at startup) ───────────────────────────────

const logOutput    = document.getElementById('log-output');
const statPacks    = document.getElementById('stat-packs');
const statCards    = document.getElementById('stat-cards');
const statPity     = document.getElementById('stat-pity');
const statCommon   = document.getElementById('stat-common');
const statRare     = document.getElementById('stat-rare');
const statEpic     = document.getElementById('stat-epic');
const statLegendary = document.getElementById('stat-legendary');

// Track how many log lines have already been rendered to avoid re-rendering
let _renderedLogCount = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Classify a log message and return a CSS class name for colour coding.
 * @param {string} msg
 * @returns {string}
 */
function classifyMessage(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('legendary'))           return 'log-legendary';
  if (lower.includes('epic'))                return 'log-epic';
  if (lower.includes('rare'))                return 'log-rare';
  if (lower.includes('pity'))                return 'log-pity';
  if (lower.includes('pack #'))              return 'log-pack-header';
  if (lower.includes('batch') || lower.includes('---')) return 'log-batch';
  if (lower.startsWith('  →') || lower.startsWith('  total') || lower.includes('initialized') || lower.includes('reset')) {
    return 'log-system';
  }
  return 'log-common';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append any new log messages from the engine's event log to the DOM.
 * Only appends lines added since the last render call (incremental).
 * @param {string[]} eventLog  engine.eventLog array
 */
export function renderLogs(eventLog) {
  const newMessages = eventLog.slice(_renderedLogCount);

  for (const msg of newMessages) {
    // Insert a visual separator before each "Pack #" line
    if (msg.match(/^Pack #/)) {
      const hr = document.createElement('hr');
      hr.className = 'log-separator';
      logOutput.appendChild(hr);
    }

    const line = document.createElement('div');
    line.textContent = msg;
    line.className = classifyMessage(msg);
    logOutput.appendChild(line);
  }

  _renderedLogCount += newMessages.length;

  // Auto-scroll to the latest log line
  logOutput.scrollTop = logOutput.scrollHeight;
}

/**
 * Update the simulation state panel with values from engine.state.
 * @param {Object} state  engine.state
 */
export function renderState(state) {
  statPacks.textContent     = state.packsOpened;
  statCards.textContent     = state.cards.length;
  statPity.textContent      = state.pityCounter;
  statCommon.textContent    = state.rarityStats.common;
  statRare.textContent      = state.rarityStats.rare;
  statEpic.textContent      = state.rarityStats.epic;
  statLegendary.textContent = state.rarityStats.legendary;
}

/**
 * Full refresh — render both logs and state in one call.
 * Call this after every simulation step or batch.
 * @param {Engine} engine
 */
export function refreshDisplay(engine) {
  renderLogs(engine.eventLog);
  renderState(engine.state);
}

/**
 * Clear the log panel and reset the internal render counter.
 * Call this when the simulation is reset.
 */
export function clearDisplay() {
  logOutput.innerHTML = '';
  _renderedLogCount = 0;
}
