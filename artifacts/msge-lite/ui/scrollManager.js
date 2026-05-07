/**
 * ui/scrollManager.js — Phase 9 stabilization
 *
 * Reference-counted overlay-safe body scroll lock/unlock.
 * Multiple overlays can stack; body only unfreezes when all are closed.
 * Preserves scroll position on iOS/mobile (position:fixed trick).
 *
 * Phase 10.1.8: when ?noscroll=1 (or ?debugall=1) is in the URL, both
 * lockBodyScroll and unlockBodyScroll become no-ops. This removes the
 * `position:fixed` trick from the body during isolation testing — the
 * trick has been suspected (in past iOS WebKit versions) of breaking
 * subsequent click synthesis on offscreen scroll areas.
 */

import { DEBUG_FLAGS, isDebugMode } from '../data/debugFlags.js';

let _scrollY      = 0;
let _overlayCount = 0;

/** Returns current scroll-lock nesting depth (for diagnostics overlay). */
export function getLockDepth() { return _overlayCount; }

export function lockBodyScroll() {
  if (DEBUG_FLAGS.noScroll) {
    if (isDebugMode()) console.log('[ScrollMgr] lockBodyScroll() SKIPPED (noScroll flag)');
    return;
  }
  _overlayCount++;
  if (_overlayCount > 1) return;

  _scrollY = window.scrollY;

  document.body.style.position = 'fixed';
  document.body.style.top      = `-${_scrollY}px`;
  document.body.style.left     = '0';
  document.body.style.right    = '0';
  document.body.style.width    = '100%';
  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll() {
  if (DEBUG_FLAGS.noScroll) {
    if (isDebugMode()) console.log('[ScrollMgr] unlockBodyScroll() SKIPPED (noScroll flag)');
    return;
  }
  _overlayCount = Math.max(0, _overlayCount - 1);
  if (_overlayCount > 0) return;

  const y = Math.abs(parseInt(document.body.style.top || '0', 10));

  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.left     = '';
  document.body.style.right    = '';
  document.body.style.width    = '';
  document.body.style.overflow = '';

  window.scrollTo(0, y);
}
