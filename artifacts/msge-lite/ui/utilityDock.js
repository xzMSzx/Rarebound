/**
 * ui/utilityDock.js — Phase 10.1
 *
 * Collapsible top-right dock that houses the Help and Settings buttons.
 * Replaces the previous pair of always-visible floating icons (which
 * could collide with the balance display at top of viewport).
 *
 * Trigger: a single circular dot button. Tap to expand vertically into
 * Help + Settings. Tap again, or tap outside, to collapse.
 */

import { haptic } from '../data/hapticManager.js';
import { sfx } from '../data/ambientAudioManager.js';
import { openHelpScreen } from './helpScreen.js';
import { openSettingsScreen } from './settingsScreen.js';
import { DEBUG_FLAGS, isDebugMode } from '../data/debugFlags.js';

let dockEl, triggerEl, expanded = false;

function setExpanded(on) {
  expanded = on;
  dockEl.classList.toggle('is-open', on);
  triggerEl.setAttribute('aria-expanded', on ? 'true' : 'false');
}

function handleOutsideClick(e) {
  if (!expanded) return;
  if (dockEl.contains(e.target)) return;
  setExpanded(false);
}

export function initUtilityDock() {
  // Phase 10.1.8: hard-isolation flag. When ?nodock=1 (or ?debugall=1) is set,
  // we (a) hide the dock visually and (b) attach NO listeners — including the
  // global document click listener at the end of this function. This proves /
  // disproves whether the dock subsystem is responsible for global click loss.
  if (DEBUG_FLAGS.noDock) {
    const el = document.getElementById('utility-dock');
    if (el) el.style.display = 'none';
    if (isDebugMode()) console.log('[UtilityDock] init SKIPPED (noDock flag) — no listeners attached');
    return;
  }
  dockEl    = document.getElementById('utility-dock');
  triggerEl = document.getElementById('utility-dock-trigger');
  if (!dockEl || !triggerEl) return;

  triggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    haptic('soft');
    sfx.click();
    setExpanded(!expanded);
  });

  dockEl.querySelector('#utility-dock-help')?.addEventListener('click', () => {
    haptic('soft');
    sfx.click();
    setExpanded(false);
    openHelpScreen();
  });

  dockEl.querySelector('#utility-dock-settings')?.addEventListener('click', () => {
    haptic('soft');
    sfx.click();
    setExpanded(false);
    openSettingsScreen();
  });

  document.addEventListener('click', handleOutsideClick, { passive: true });
}
