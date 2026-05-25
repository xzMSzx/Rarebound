// data/vendorTimers.js — Lightweight timer coordinator
const TIMER_STORE_KEY = 'rarebound_vendor_timers_v1';

let _timers = {}; // id -> { endsAt, label }
// REFACTOR: Store only one active subscriber per id to prevent zombie stacking.
// If multiple views need the same timer, they should re-subscribe on render.
let _subs = {}; // id -> cb
let _tickHandle = null;

function _load() {
  try {
    const raw = localStorage.getItem(TIMER_STORE_KEY);
    if (!raw) return;
    _timers = JSON.parse(raw) || {};
  } catch (e) { _timers = {}; }
}

function _save() {
  try { localStorage.setItem(TIMER_STORE_KEY, JSON.stringify(_timers)); } catch (e) { }
}

function _now() { return Date.now(); }

function _ensureTicker() {
  if (_tickHandle) return;
  _tickHandle = setInterval(() => {
    const now = _now();
    for (const id of Object.keys(_timers)) {
        const t = _timers[id];
        const remain = Math.max(0, t.endsAt - now);
        
        // Execute the single active subscriber
        if (_subs[id] && typeof _subs[id] === 'function') {
          try { 
            _subs[id](remain); 
          } catch (err) { 
            console.warn('[vendorTimers] Safe-caught subscriber error:', err.message);
          }
        }

      if (remain <= 0) {
        // expire
        if (t.callback && typeof t.callback === 'function') {
          try { t.callback(); } catch (err) { console.error('[vendorTimers] callback error', err); }
        }
        delete _timers[id];
        delete _subs[id]; // Cleanup subscriber
        _save();
      }
    }
    if (Object.keys(_timers).length === 0) {
      clearInterval(_tickHandle); 
      _tickHandle = null;
    }
  }, 1000);
}

function ensureTimer(id, endsAt, opts = {}) {
  if (!id || !endsAt) return;
  _load();
  _timers[id] = Object.assign({}, _timers[id] || {}, { endsAt: +endsAt, label: opts.label || '', callback: opts.onExpire || opts.callback || null });
  _save();
  _ensureTicker();
}

function getRemainingMs(id) {
  _load();
  const t = _timers[id];
  if (!t) return 0;
  return Math.max(0, t.endsAt - _now());
}

function subscribe(id, cb) {
  if (!id || typeof cb !== 'function') return () => {};
  
  // PREVENT ZOMBIES: Overwrite existing subscriber for this ID.
  // In our UI, only the most recently rendered view should control the timer DOM.
  if (_subs[id]) {
    console.warn(`[vendorTimers] Overwriting duplicate timer subscription for: ${id}`);
  }
  _subs[id] = cb;
  
  _ensureTicker();
  
  return () => { 
    if (_subs[id] === cb) {
      delete _subs[id]; 
    }
  };
}

// ... rest remains same

function formatMs(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
  if (m > 0) return `${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
  return `${String(sec).padStart(2,'0')}s`;
}

// compute next UTC day boundary (deterministic daily refresh)
function nextDailyRefreshTimestamp() {
  const day = Math.floor(Date.now() / 86400000) + 1;
  return day * 86400000;
}

export { ensureTimer, getRemainingMs, subscribe, formatMs, nextDailyRefreshTimestamp };
