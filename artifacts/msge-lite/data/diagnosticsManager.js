/**
 * data/diagnosticsManager.js — Phase 10.3
 *
 * Persistent internal developer diagnostics system.
 * Gate-locked behind Developer Access — zero footprint in production.
 *
 * Storage keys:
 *   tcg_dev_diagnostics  — master boolean (string 'true'/'false')
 *   tcg_dev_diag_flags   — sub-option flags JSON
 *   tcg_dev_isolation    — subsystem isolation flags JSON (require reload)
 */

// ─── Master toggle ─────────────────────────────────────────────────────────

const MASTER_KEY = 'tcg_dev_diagnostics';
const FLAGS_KEY  = 'tcg_dev_diag_flags';
const ISO_KEY    = 'tcg_dev_isolation';

export function isDiagnosticsEnabled() {
  return localStorage.getItem(MASTER_KEY) === 'true';
}

export function setDiagnosticsEnabled(bool) {
  if (bool) {
    localStorage.setItem(MASTER_KEY, 'true');
    // Seed sub-flags to sensible defaults on first enable
    const existing = _readDiagFlags();
    if (!existing._seeded) {
      _writeDiagFlags({ ...DIAG_FLAG_DEFAULTS, _seeded: true });
    }
  } else {
    localStorage.removeItem(MASTER_KEY);
  }
}

// ─── Sub-option flags ───────────────────────────────────────────────────────

export const DIAG_FLAG_DEFAULTS = {
  showOverlay:  true,
  showDebugTap: false,
  touchTrace:   true,
  navAudit:     true,
  audioDiag:    false,
};

function _readDiagFlags() {
  try { return { ...DIAG_FLAG_DEFAULTS, ...JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}') }; }
  catch { return { ...DIAG_FLAG_DEFAULTS }; }
}

function _writeDiagFlags(flags) {
  localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
}

export function getDiagFlags() { return _readDiagFlags(); }

export function setDiagFlag(key, val) {
  const f = _readDiagFlags();
  f[key] = val;
  _writeDiagFlags(f);
}

/**
 * Returns true only when master diagnostics is ON and the specific sub-flag is
 * explicitly enabled (or at its seeded default of true).
 */
export function isDiagFlag(key) {
  if (!isDiagnosticsEnabled()) return false;
  const f = _readDiagFlags();
  return f[key] !== false;
}

// ─── Isolation flags (require reload to apply) ─────────────────────────────

const ISO_DEFAULTS = {
  noDock: false, noAudio: false, noScroll: false,
  noBoot: false, noOverlays: false, noIosTap: false,
};

export function getDiagIsolation() {
  try { return { ...ISO_DEFAULTS, ...JSON.parse(localStorage.getItem(ISO_KEY) || '{}') }; }
  catch { return { ...ISO_DEFAULTS }; }
}

export function setDiagIsolation(flags) {
  localStorage.setItem(ISO_KEY, JSON.stringify({ ...ISO_DEFAULTS, ...flags }));
}

// ─── Diagnostics overlay ────────────────────────────────────────────────────

let _overlayEl  = null;
let _rafId      = null;
let _fps        = 0;
let _frames     = 0;
let _lastFpsTs  = 0;
let _tickTimer  = null;

function _fpsLoop(now) {
  _frames++;
  if (now - _lastFpsTs >= 1000) {
    _fps       = Math.round(_frames * 1000 / (now - _lastFpsTs));
    _frames    = 0;
    _lastFpsTs = now;
  }
  _rafId = requestAnimationFrame(_fpsLoop);
}

function _currentScreen() {
  const el = [...document.querySelectorAll('.screen')].find(
    s => !s.classList.contains('hidden') && s.style.display !== 'none' && s.id !== 'hub-screen'
  );
  return el ? el.id.replace('-screen', '') : 'hub';
}

function _visibleModals() {
  return [...document.querySelectorAll('.confirm-card')].filter(el => {
    let p = el.parentElement;
    while (p) { if (p.classList?.contains('hidden')) return false; p = p.parentElement; }
    return true;
  }).length;
}

function _buildOverlayHTML() {
  const lockDepth  = window.__diag_getLockDepth?.()     ?? '—';
  const audioState = window.__diag_getAudioCtxState?.() ?? '—';
  return [
    ['fps',         _fps],
    ['screen',      _currentScreen()],
    ['scroll lock', lockDepth],
    ['audio ctx',   audioState],
    ['modals',      _visibleModals()],
  ].map(([k, v]) =>
    `<div class="diag-row"><span class="diag-key">${k}</span><span class="diag-val">${v}</span></div>`
  ).join('');
}

function _tick() {
  if (!_overlayEl) return;
  _overlayEl.innerHTML = _buildOverlayHTML();
  _tickTimer = setTimeout(_tick, 1000);
}

export function mountDiagnosticsOverlay() {
  if (_overlayEl) return;
  _overlayEl = document.createElement('div');
  _overlayEl.id        = 'rarebound-diag-overlay';
  _overlayEl.className = 'diag-overlay';
  document.body.appendChild(_overlayEl);
  _lastFpsTs = performance.now();
  _rafId     = requestAnimationFrame(_fpsLoop);
  _tick();
}

export function unmountDiagnosticsOverlay() {
  if (_rafId)     { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_tickTimer) { clearTimeout(_tickTimer);     _tickTimer = null; }
  _overlayEl?.remove();
  _overlayEl = null;
}

// ─── Debug Tap Button ───────────────────────────────────────────────────────

let _tapBtn = null;

export function mountDebugTapBtn() {
  if (_tapBtn || document.getElementById('phase1018-debug-tap')) return;
  _tapBtn          = document.createElement('button');
  _tapBtn.id       = 'phase1018-debug-tap';
  _tapBtn.type     = 'button';
  _tapBtn.textContent = 'DEBUG TAP';
  Object.assign(_tapBtn.style, {
    position: 'fixed', top: '120px', left: '20px', width: '120px', height: '48px',
    zIndex: '999999', background: '#e22', color: '#fff', border: '2px solid #fff',
    borderRadius: '6px', fontFamily: 'system-ui,-apple-system,sans-serif',
    fontSize: '13px', fontWeight: '700', letterSpacing: '0.04em',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)', pointerEvents: 'auto',
    touchAction: 'manipulation', cursor: 'pointer',
  });
  _tapBtn.onclick = () => {
    console.log('[DebugTap] click ✅');
    // eslint-disable-next-line no-alert
    alert('DEBUG BUTTON WORKS');
  };
  ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click'].forEach(t =>
    _tapBtn.addEventListener(t, (e) =>
      console.log(`[DebugTap:${t}] | target:`, e.target?.id || e.target?.tagName),
      { passive: true, capture: false }
    )
  );
  document.body.appendChild(_tapBtn);
}

export function unmountDebugTapBtn() {
  _tapBtn?.remove();
  _tapBtn = null;
  document.getElementById('phase1018-debug-tap')?.remove();
}

// ─── Apply diagnostics state (call after toggling any flag) ────────────────

export function applyDiagnosticsState() {
  const on    = isDiagnosticsEnabled();
  const flags = _readDiagFlags();

  if (!on) {
    unmountDiagnosticsOverlay();
    unmountDebugTapBtn();
    return;
  }
  if (flags.showOverlay)  mountDiagnosticsOverlay(); else unmountDiagnosticsOverlay();
  if (flags.showDebugTap) mountDebugTapBtn();         else unmountDebugTapBtn();
}

// ─── Boot-time init ─────────────────────────────────────────────────────────

/**
 * Called once from main.js after the app is fully ready.
 * Restores overlay + debug tap from persisted state silently.
 */
export function initDiagnosticsFromStorage() {
  if (!isDiagnosticsEnabled()) return;
  applyDiagnosticsState();
}
