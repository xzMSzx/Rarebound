/**
 * data/hapticManager.js — Phase 10
 *
 * Thin wrapper over navigator.vibrate. Gated by the user's haptics setting
 * and silently no-ops on devices without vibration support.
 *
 * Strengths follow the spec:
 *   soft   — taps, wishlist add        (10ms)
 *   medium — page turn, sell confirm   (25ms)
 *   heavy  — rare pulls, chase, rank   (45ms double-tap)
 */

import { getSetting } from './settingsManager.js';

const PATTERNS = {
  soft:   [10],
  medium: [25],
  heavy:  [45, 30, 45],
};

export function haptic(strength = 'soft') {
  if (!getSetting('haptics')) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const pattern = PATTERNS[strength] || PATTERNS.soft;
  try { navigator.vibrate(pattern); } catch { /* silent */ }
}
