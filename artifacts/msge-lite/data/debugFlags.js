/**
 * data/debugFlags.js — Phase 10.1.8 HARD ISOLATION DEBUG MODE
 *
 * URL-flag-driven feature toggles for controlled subsystem elimination.
 * Set ANY combination of these in the URL bar on the device, then reload:
 *
 *   ?nodock=1         — skip utility dock init (kills its document click listener)
 *   ?noaudio=1        — skip ambient audio + audio-unlock document listeners
 *   ?noscroll=1       — turn lockBodyScroll / unlockBodyScroll into no-ops
 *   ?noboot=1         — skip boot screen entirely, render Vendor Hub immediately
 *   ?nooverlays=1     — REMOVE help/settings/card-detail/sell modal nodes from DOM
 *   ?noiostap=1       — turn iosTap() into a no-op (rely on native click only)
 *   ?debugall=1       — shorthand: turns ON every disable above at once
 *
 * Phase 10.2 — master debug gate:
 *   ?debug=1                   — enables all diagnostic output without disabling subsystems
 *   window.__RAREBOUND_DEBUG__ — same as ?debug=1, set from DevTools console
 *
 * Phase 10.3 — persistent diagnostics:
 *   tcg_dev_diagnostics in localStorage — set via Settings → Developer Access → System Diagnostics
 *   tcg_dev_isolation in localStorage   — UI-set subsystem flags (same effect as URL flags)
 *
 * Normal production users never see debug logs, the DEBUG TAP button, or
 * verbose tracing. Subsystem isolation flags (?nodock etc.) always imply
 * debug mode — any active flag gates diagnostics on automatically.
 */

const params = new URLSearchParams(
  typeof window !== 'undefined' ? window.location.search : ''
);

const _all = params.get('debugall') === '1';

/** Read UI-persisted isolation flags (set via Settings → System Diagnostics). */
function _readIsoStorage() {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('tcg_dev_isolation') || '{}'); }
  catch { return {}; }
}

const _iso = _readIsoStorage();

export const DEBUG_FLAGS = Object.freeze({
  noDock:     _all || params.get('nodock')     === '1' || !!_iso.noDock,
  noAudio:    _all || params.get('noaudio')    === '1' || !!_iso.noAudio,
  noScroll:   _all || params.get('noscroll')   === '1' || !!_iso.noScroll,
  noBoot:     _all || params.get('noboot')     === '1' || !!_iso.noBoot,
  noOverlays: _all || params.get('nooverlays') === '1' || !!_iso.noOverlays,
  noIosTap:   _all || params.get('noiostap')   === '1' || !!_iso.noIosTap,
});

/**
 * Returns true when any debug output should be emitted.
 * True when: ?debug=1, window.__RAREBOUND_DEBUG__, ?debugall=1,
 * any individual isolation flag is active, or the persistent
 * Developer Diagnostics setting is enabled.
 * Normal production loads (no flags, diagnostics off) return false.
 */
export function isDebugMode() {
  if (params.get('debug') === '1') return true;
  if (typeof window !== 'undefined' && window.__RAREBOUND_DEBUG__) return true;
  if (typeof localStorage !== 'undefined' && localStorage.getItem('tcg_dev_diagnostics') === 'true') return true;
  return Object.values(DEBUG_FLAGS).some(Boolean);
}

/** Boot-time log of which subsystems are disabled. Only called in debug mode. */
export function logActiveFlags() {
  const active = Object.entries(DEBUG_FLAGS)
    .filter(([, on]) => on)
    .map(([k]) => k);
  if (active.length === 0) {
    console.log(
      '%c[DebugFlags] All subsystems ENABLED (normal mode).',
      'color:#7cf;font-weight:bold'
    );
  } else {
    console.log(
      '%c[DebugFlags] HARD ISOLATION MODE — disabled: ' + active.join(', '),
      'color:#f44;font-weight:bold;font-size:14px'
    );
  }
}

/**
 * Returns true only when a URL/console flag is the reason debug mode is active
 * (i.e. ?debug=1, window.__RAREBOUND_DEBUG__, or any ?no* isolation flag).
 * Used at boot to distinguish URL-flag debug tap from persistent-diagnostics tap,
 * which is managed later by initDiagnosticsFromStorage() in diagnosticsManager.js.
 */
export function isDebugFromUrl() {
  if (params.get('debug') === '1') return true;
  if (typeof window !== 'undefined' && window.__RAREBOUND_DEBUG__) return true;
  return Object.values(DEBUG_FLAGS).some(Boolean);
}

/**
 * Inject the DEBUG TAP button (Phase 10.1.8 / Phase 10.3).
 * Only called in debug mode — never visible to normal production users.
 * Phase 10.3: prefer mountDebugTapBtn() from diagnosticsManager for runtime
 * toggle support. This function is kept for URL-flag boot-time activation.
 */
export function mountDebugTapButton() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('phase1018-debug-tap')) return;

  const btn = document.createElement('button');
  btn.id          = 'phase1018-debug-tap';
  btn.type        = 'button';
  btn.textContent = 'DEBUG TAP';
  Object.assign(btn.style, {
    position:        'fixed',
    top:             '120px',
    left:            '20px',
    width:           '120px',
    height:          '48px',
    zIndex:          '999999',
    background:      '#e22',
    color:           '#fff',
    border:          '2px solid #fff',
    borderRadius:    '6px',
    fontFamily:      'system-ui, -apple-system, sans-serif',
    fontSize:        '13px',
    fontWeight:      '700',
    letterSpacing:   '0.04em',
    boxShadow:       '0 4px 12px rgba(0,0,0,0.5)',
    pointerEvents:   'auto',
    touchAction:     'manipulation',
    cursor:          'pointer',
    display:         'block',
    visibility:      'visible',
    opacity:         '1',
  });

  btn.onclick = () => {
    console.log('[DebugTap] click handler fired ✅');
    // eslint-disable-next-line no-alert
    alert('DEBUG BUTTON WORKS');
  };

  ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click'].forEach(t => {
    btn.addEventListener(t, (e) => {
      console.log(
        `[DebugTap:${t}]`,
        '| target:', e.target?.id || e.target?.tagName,
        '| defaultPrevented:', e.defaultPrevented,
        '| cancelable:', e.cancelable,
      );
    }, { passive: true, capture: false });
  });

  document.body.appendChild(btn);
  console.log('[DebugTap] mounted at top-left, z-index 999999');
}
