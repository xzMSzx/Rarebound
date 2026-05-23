// data/vendorTimers.js — Lightweight timer coordinator
const TIMER_STORE_KEY = 'rarebound_vendor_timers_v1';

let _timers = {}; // id -> { endsAt, label }
let _subs = {}; // id -> [cb]
let _isBackgrounded = false;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _isBackgrounded = true;
    } else {
      _isBackgrounded = false;
      // Immediately calculate delta on return
      if (_tickHandle) _tick();
    }
  });
}
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
  function _tick() {
    if (_isBackgrounded) return;
    const now = _now();
    for (const id of Object.keys(_timers)) {
      const t = _timers[id];
      const remain = Math.max(0, t.endsAt - now);
      if (_subs[id]) {
        for (const cb of _subs[id]) cb(remain);
      }
      if (remain <= 0) {
        // expire
        try { if (typeof t.onExpire === 'string') { /* noop */ } } catch(e){}
        if (t.callback && typeof t.callback === 'function') {
          try { t.callback(); } catch (err) { console.error('[vendorTimers] callback error', err); }
        }
        delete _timers[id];
        _save();
      }
    }
    if (Object.keys(_timers).length === 0) {
      clearInterval(_tickHandle); _tickHandle = null;
    }
}
_tickHandle = setInterval(_tick, 1000);
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
  _subs[id] = _subs[id] || [];
  _subs[id].push(cb);
  _ensureTicker();
  return () => { _subs[id] = (_subs[id] || []).filter(x => x !== cb); };
}

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
