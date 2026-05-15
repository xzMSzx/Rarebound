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
const _activeSources = new Set();
let _unnamedCount = 0;

/** Returns current scroll-lock nesting depth (for diagnostics overlay). */
export function getLockDepth() { return _activeSources.size + _unnamedCount; }

export function lockBodyScroll(source) {
  if (DEBUG_FLAGS.noScroll) {
    if (isDebugMode()) console.log('[ScrollMgr] lockBodyScroll() SKIPPED (noScroll flag)');
    return;
  }
  
  if (source) {
    if (_activeSources.has(source)) {
      console.warn(`[ScrollMgr] Duplicate lock attempt from ${source}`);
      return;
    }
    _activeSources.add(source);
  } else {
    _unnamedCount++;
  }

  const depth = getLockDepth();
  if (isDebugMode()) console.log(`[ScrollMgr] lockBodyScroll(${source || 'unnamed'}) - Depth: ${depth}`);

  if (depth > 1) return;

  _scrollY = window.scrollY;

  document.body.style.position = 'fixed';
  document.body.style.top      = `-${_scrollY}px`;
  document.body.style.left     = '0';
  document.body.style.right    = '0';
  document.body.style.width    = '100%';
  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(source) {
  if (DEBUG_FLAGS.noScroll) {
    if (isDebugMode()) console.log('[ScrollMgr] unlockBodyScroll() SKIPPED (noScroll flag)');
    return;
  }
  
  if (source) {
    if (!_activeSources.has(source)) {
      console.warn(`[ScrollMgr] Unlock mismatch or duplicate from ${source}`);
      return;
    }
    _activeSources.delete(source);
  } else {
    _unnamedCount = Math.max(0, _unnamedCount - 1);
  }

  const depth = getLockDepth();
  if (isDebugMode()) console.log(`[ScrollMgr] unlockBodyScroll(${source || 'unnamed'}) - Depth: ${depth}`);

  if (depth > 0) return;

  const y = Math.abs(parseInt(document.body.style.top || '0', 10));

  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.left     = '';
  document.body.style.right    = '';
  document.body.style.width    = '';
  document.body.style.overflow = '';

  window.scrollTo(0, y);
}

// Emergency recovery protection
function emergencyRecoverScroll() {
  if (getLockDepth() === 0) return;
  
  // Check for any visible modals, overlays, or fullscreen UI
  const possibleOverlays = document.querySelectorAll(
    '.fullscreen-overlay, .modal-backdrop, .slab-viewer, [role="dialog"], .fullscreen-modal, .ags-reveal-overlay'
  );
  
  let hasVisible = false;
  for (const el of possibleOverlays) {
    if (el.style.display !== 'none' && !el.classList.contains('hidden')) {
      hasVisible = true;
      break;
    }
  }

  if (!hasVisible) {
    console.warn(`[ScrollMgr] Emergency recovery: Unlocking scroll. Locks were active (${getLockDepth()}) but no overlays are visible.`);
    _activeSources.clear();
    _unnamedCount = 0;
    
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.left     = '';
    document.body.style.right    = '';
    document.body.style.width    = '';
    document.body.style.overflow = '';
  }
}

// Run the emergency check every 2 seconds
setInterval(emergencyRecoverScroll, 2000);
