/**
 * ui/mobileLayoutManager.js
 * Applies mobile-aware layout tweaks at runtime.
 *
 * Responsibilities:
 *   - Detect small viewports and add a body class for CSS hooks
 *   - Re-evaluate on window resize (debounced)
 *
 * Visual contrast and button-size improvements live in style.css.
 * This module only handles JS-side responsive concerns.
 */

const MOBILE_BREAKPOINT = 700; // px — matches the CSS media query

let _resizeTimer = null;

function applyClasses() {
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  document.body.classList.toggle('is-mobile', isMobile);
}

function onResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(applyClasses, 80);
}

/**
 * Initialise the layout manager.
 * Call once after DOMContentLoaded (or at module evaluation time).
 */
export function initMobileLayoutManager() {
  applyClasses();
  window.addEventListener('resize', onResize, { passive: true });
}

/**
 * Returns true when the viewport is currently considered "mobile".
 */
export function isMobileViewport() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}
