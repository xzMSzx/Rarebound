/**
 * ui/swipeController.js
 * Lightweight touch-gesture detector.
 *
 * Listens on a target element and fires:
 *   onSwipeLeft() — horizontal swipe to the left (distance >= threshold)
 *   onTap()       — finger lifted without significant movement
 *
 * Returns a cleanup() function that removes all event listeners.
 */

const SWIPE_THRESHOLD = 55;  // px — minimum horizontal travel to count as a swipe
const TAP_THRESHOLD   = 12;  // px — maximum travel for a gesture to count as a tap

/**
 * @param {HTMLElement} element
 * @param {{ onSwipeLeft: () => void, onTap: () => void }} callbacks
 * @returns {{ cleanup: () => void }}
 */
export function attachSwipeController(element, { onSwipeLeft, onTap }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  function handleTouchStart(e) {
    const touch = e.changedTouches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  }

  function handleTouchEnd(e) {
    if (!tracking) return;
    tracking = false;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Ignore primarily-vertical swipes
    if (absDy > absDx * 1.5) return;

    if (absDx < TAP_THRESHOLD && absDy < TAP_THRESHOLD) {
      onTap?.();
    } else if (absDx >= SWIPE_THRESHOLD) {
      // Both left and right swipes trigger reveal
      onSwipeLeft?.();
    }
  }

  function handleTouchCancel() {
    tracking = false;
  }

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend',   handleTouchEnd,   { passive: true });
  element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

  // Also allow mouse click on desktop so the overlay is usable without touch
  function handleClick() {
    onTap?.();
  }
  element.addEventListener('click', handleClick);

  function cleanup() {
    element.removeEventListener('touchstart',  handleTouchStart);
    element.removeEventListener('touchend',    handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchCancel);
    element.removeEventListener('click',       handleClick);
  }

  return { cleanup };
}
