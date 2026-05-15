/**
 * ui/overlayScrollLock.js — tiny shared helpers for fullscreen overlays.
 */

/**
 * @param {(e: KeyboardEvent) => void} onEscape — called when Escape is pressed
 * @returns {() => void} disposer
 */
export function onEscapeKey(onEscape) {
  const wrapped = (e) => {
    if (e.key !== 'Escape') return;
    onEscape(e);
  };
  document.addEventListener('keydown', wrapped, true);
  return () => document.removeEventListener('keydown', wrapped, true);
}
