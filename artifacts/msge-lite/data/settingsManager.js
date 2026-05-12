/**
 * data/settingsManager.js — Phase 10.1
 *
 * Centralized user settings: ambient audio, haptics, reduced motion.
 * Persisted under `tcg_settings`. New keys merge safely with defaults
 * so older saves never break.
 */

const STORAGE_KEY = 'tcg_settings';
export const APP_VERSION = '1.6.0';

const DEFAULTS = Object.freeze({
  ambientAudio:  false,   // OFF by default — opt-in atmosphere
  haptics:       true,
  reducedMotion: false,
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return { ...DEFAULTS, ...raw };
  } catch { return { ...DEFAULTS }; }
}

function save(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getSettings() { return load(); }

export function getSetting(key) { return load()[key]; }

export function setSetting(key, value) {
  const s = load();
  s[key] = value;
  save(s);
  applyReducedMotion();
  return s;
}

/** Toggle the `data-reduced-motion` attribute on <html> for CSS hooks. */
export function applyReducedMotion() {
  const on = !!load().reducedMotion;
  document.documentElement.toggleAttribute('data-reduced-motion', on);
}

/**
 * Wipes every namespaced `tcg_*` key. Used by Settings → Reset Local Save.
 * Caller is responsible for reloading the page afterward.
 */
export function resetLocalSave() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('tcg_')) toRemove.push(key);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
