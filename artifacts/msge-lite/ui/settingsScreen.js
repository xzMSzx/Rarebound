/**
 * ui/settingsScreen.js — Phase 10.3
 *
 * Premium settings panel + Developer Access entry point. The dev tools
 * subsection only appears once the user has unlocked dev mode via the
 * passphrase modal. System Diagnostics subsection is collapsed by default.
 */

import {
  getSettings, setSetting, resetLocalSave, APP_VERSION,
} from '../data/settingsManager.js';
import { haptic } from '../data/hapticManager.js';
import { sfx, refreshAmbientFromSettings } from '../data/ambientAudioManager.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';
import {
  isDevUnlocked, tryUnlockDev, lockDev,
  isInfiniteBalance, setInfiniteBalance,
} from '../data/devAccess.js';
import { regenerateAllVendorStocks, regenerateVendorStock } from '../data/vendorManager.js';
import { runRefresh } from '../data/economyManager.js';
import { addBalance } from '../state/playerState.js';
import { clearHistory } from '../data/marketHistory.js';
import {
  isDiagnosticsEnabled, setDiagnosticsEnabled,
  getDiagFlags, setDiagFlag,
  getDiagIsolation, setDiagIsolation,
  applyDiagnosticsState,
} from '../data/diagnosticsManager.js';

let screenEl;

// Hooks the host wires up so dev tools can refresh the live UI.
let _hooks = {};
export function setSettingsHooks(hooks) { _hooks = { ...hooks }; }

// ─── System Diagnostics section ────────────────────────────────────────────

const ISO_LABELS = {
  noDock:     'Disable Utility Dock',
  noAudio:    'Disable Ambient Audio',
  noScroll:   'Disable Scroll Manager',
  noBoot:     'Disable Boot Screen',
  noOverlays: 'Disable Overlay Nodes',
  noIosTap:   'Disable iOS Tap Helper',
};

function diagSectionHTML() {
  const diagOn  = isDiagnosticsEnabled();
  const flags   = getDiagFlags();
  const iso     = getDiagIsolation();
  const anyIso  = Object.values(iso).some(Boolean);

  const isoRows = Object.entries(ISO_LABELS).map(([key, label]) => `
    <div class="diag-sub-row">
      <span class="diag-sub-label">${label}</span>
      <label class="toggle-switch toggle-switch--sm">
        <input type="checkbox" class="diag-iso-toggle" data-iso="${key}" ${iso[key] ? 'checked' : ''} ${!diagOn ? 'disabled' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');

  return `
    <div class="diag-section" id="diag-section">
      <button class="diag-section-header" id="diag-section-toggle" type="button">
        <span class="diag-section-title">System Diagnostics</span>
        <span class="diag-section-chevron" id="diag-chevron">▾</span>
      </button>

      <div class="diag-section-body" id="diag-section-body">

        <div class="settings-row dev-tool-toggle-row diag-master-row">
          <div class="settings-row-text">
            <div class="settings-row-title">Developer Diagnostics</div>
            <div class="settings-row-desc">Enables internal logging, overlay, and debug tools.</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="diag-master-toggle" ${diagOn ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="diag-sub-options ${diagOn ? '' : 'diag-sub-disabled'}">

          <div class="diag-sub-group-title">Display</div>

          <div class="diag-sub-row">
            <span class="diag-sub-label">Diagnostic Overlay</span>
            <label class="toggle-switch toggle-switch--sm">
              <input type="checkbox" id="diag-overlay-toggle"
                ${flags.showOverlay ? 'checked' : ''} ${!diagOn ? 'disabled' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="diag-sub-row">
            <span class="diag-sub-label">Debug Tap Button</span>
            <label class="toggle-switch toggle-switch--sm">
              <input type="checkbox" id="diag-tap-toggle"
                ${flags.showDebugTap ? 'checked' : ''} ${!diagOn ? 'disabled' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="diag-sub-group-title">Interaction Tracing
            <span class="diag-reload-badge">Reload to apply</span>
          </div>

          <div class="diag-sub-row">
            <span class="diag-sub-label">Touch Trace</span>
            <label class="toggle-switch toggle-switch--sm">
              <input type="checkbox" id="diag-touchtrace-toggle"
                ${flags.touchTrace !== false ? 'checked' : ''} ${!diagOn ? 'disabled' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="diag-sub-row">
            <span class="diag-sub-label">Nav Audit</span>
            <label class="toggle-switch toggle-switch--sm">
              <input type="checkbox" id="diag-navaudit-toggle"
                ${flags.navAudit !== false ? 'checked' : ''} ${!diagOn ? 'disabled' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="diag-sub-row">
            <span class="diag-sub-label">Audio Diagnostics</span>
            <label class="toggle-switch toggle-switch--sm">
              <input type="checkbox" id="diag-audioDiag-toggle"
                ${flags.audioDiag ? 'checked' : ''} ${!diagOn ? 'disabled' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="diag-sub-group-title">Subsystem Isolation
            <span class="diag-reload-badge">Reload to apply</span>
          </div>

          ${isoRows}

          <div class="diag-reload-row ${anyIso ? 'diag-reload-visible' : ''}" id="diag-reload-row">
            <span class="diag-reload-notice">Isolation flags active — reload to apply.</span>
            <button class="dev-tool-btn diag-reload-btn" id="diag-reload-btn" type="button">Reload App</button>
          </div>

        </div>
      </div>
    </div>
  `;
}

function devToolsHTML() {
  const infinite = isInfiniteBalance();
  return `
    <section class="settings-group dev-tools">
      <div class="dev-tools-title">Archive Utilities</div>
      <div class="dev-tools-sub">Restricted testing tools — use with care.</div>

      <div class="dev-tool-row">
        <button class="dev-tool-btn" data-act="add100">+ $100</button>
        <button class="dev-tool-btn" data-act="add500">+ $500</button>
        <button class="dev-tool-btn" data-act="add1000">+ $1000</button>
      </div>

      <div class="settings-row dev-tool-toggle-row" data-key="infinite">
        <div class="settings-row-text">
          <div class="settings-row-title">Infinite Balance</div>
          <div class="settings-row-desc">
            Sandbox mode — pauses reputation gains while active.
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="dev-infinite-toggle" ${infinite ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="dev-tool-row">
        <button class="dev-tool-btn" data-act="refreshVendors">Refresh Vendor Inventory</button>
        <button class="dev-tool-btn" data-act="refreshMarket">Force Market Refresh</button>
      </div>
      <div class="dev-tool-row">
        <button class="dev-tool-btn" data-act="forceBroker">Force Broker Arrival</button>
        <button class="dev-tool-btn" data-act="resetRep">Reset Reputation</button>
      </div>
      <div class="dev-tool-row">
        <button class="dev-tool-btn dev-tool-btn--warn" data-act="resetEconomy">Reset Economy</button>
        <button class="dev-tool-btn dev-tool-btn--warn" data-act="clearMarketHistory">Clear Market History</button>
      </div>

      ${diagSectionHTML()}

      <button class="dev-tool-btn dev-tool-lock" data-act="lockDev">Lock Developer Access</button>
    </section>
  `;
}

function getSettingsHTML(s, dev) {
  return `
    <div class="screen-header">
      <button class="screen-back-btn" id="settings-back-btn">← Back</button>
      <h2>Settings</h2>
      <div></div>
    </div>

    <div class="settings-body">
      <section class="settings-group">
        <div class="settings-row" data-key="ambientAudio">
          <div class="settings-row-text">
            <div class="settings-row-title">Ambient Vendor Audio</div>
            <div class="settings-row-desc">
              Subtle synthesized atmosphere per vendor.
              <span class="settings-audio-hint">Activates after first interaction.</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${s.ambientAudio ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-row" data-key="haptics">
          <div class="settings-row-text">
            <div class="settings-row-title">Haptic Feedback</div>
            <div class="settings-row-desc">Subtle vibration on supported devices</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${s.haptics ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-row" data-key="reducedMotion">
          <div class="settings-row-text">
            <div class="settings-row-title">Reduced Motion</div>
            <div class="settings-row-desc">Shorten animations and transitions</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${s.reducedMotion ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section class="settings-group">
        <button class="settings-danger-btn" id="settings-reset-btn">Reset Local Save</button>
        <div class="settings-danger-note">
          Permanently clears your collection, balance, favor, and market history on this device.
        </div>
      </section>

      ${dev ? devToolsHTML() : ''}

      <button class="settings-dev-link" id="settings-dev-link">
        <span class="dev-link-lock">${dev ? '✓' : '⌬'}</span>
        ${dev ? 'Developer Access — Unlocked' : 'Developer Access'}
      </button>

      <div class="settings-footer">RAREBOUND · v${APP_VERSION}</div>
    </div>

    <div id="settings-confirm-modal" class="hidden">
      <div class="confirm-backdrop"></div>
      <div class="confirm-card">
        <div class="confirm-title">Reset everything?</div>
        <div class="confirm-body">
          Your entire collection, balance, and progression will be erased.
          This cannot be undone.
        </div>
        <div class="confirm-actions">
          <button class="confirm-cancel">Cancel</button>
          <button class="confirm-destructive">Erase save</button>
        </div>
      </div>
    </div>

    <div id="dev-access-modal" class="hidden">
      <div class="confirm-backdrop"></div>
      <div class="confirm-card dev-access-card">
        <div class="confirm-title">Developer Access</div>
        <div class="confirm-body dev-access-sub">Restricted archive utilities</div>
        <input id="dev-access-input" class="dev-access-input" type="password"
               placeholder="Access key" autocomplete="off" />
        <div class="dev-access-error hidden" id="dev-access-err">Invalid access key</div>
        <div class="confirm-actions">
          <button class="confirm-cancel" id="dev-access-cancel">Cancel</button>
          <button class="confirm-destructive" id="dev-access-unlock">Unlock</button>
        </div>
      </div>
    </div>

    <div id="dev-confirm-modal" class="hidden">
      <div class="confirm-backdrop"></div>
      <div class="confirm-card">
        <div class="confirm-title" id="dev-confirm-title">Confirm</div>
        <div class="confirm-body" id="dev-confirm-body">Are you sure?</div>
        <div class="confirm-actions">
          <button class="confirm-cancel" id="dev-confirm-cancel">Cancel</button>
          <button class="confirm-destructive" id="dev-confirm-ok">Confirm</button>
        </div>
      </div>
    </div>
  `;
}

function wireBaseSettings() {
  screenEl.querySelectorAll('.settings-row[data-key]').forEach(row => {
    const key = row.getAttribute('data-key');
    if (key === 'infinite') return;        // dev tool, wired below
    const cb  = row.querySelector('input[type="checkbox"]');
    if (!cb) return;
    cb.addEventListener('change', () => {
      setSetting(key, cb.checked);
      haptic('soft');
      sfx.click();
      if (key === 'ambientAudio') refreshAmbientFromSettings();
    });
  });

  screenEl.querySelector('#settings-back-btn').onclick = () => {
    haptic('soft');
    sfx.click();
    closeSettingsScreen();
  };
}

function wireResetModal() {
  const modal = screenEl.querySelector('#settings-confirm-modal');
  screenEl.querySelector('#settings-reset-btn').onclick = () => {
    haptic('medium');
    modal.classList.remove('hidden');
  };
  modal.querySelector('.confirm-cancel').onclick = () => modal.classList.add('hidden');
  modal.querySelector('.confirm-backdrop').onclick = () => modal.classList.add('hidden');
  modal.querySelector('.confirm-destructive').onclick = () => {
    haptic('heavy');
    resetLocalSave();
    location.reload();
  };
}

function wireDevAccess() {
  const devLink   = screenEl.querySelector('#settings-dev-link');
  const devModal  = screenEl.querySelector('#dev-access-modal');
  const devInput  = devModal.querySelector('#dev-access-input');
  const devErr    = devModal.querySelector('#dev-access-err');

  devLink.onclick = () => {
    haptic('soft');
    if (isDevUnlocked()) {
      const dev = screenEl.querySelector('.dev-tools');
      if (dev) dev.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    devErr.classList.add('hidden');
    devInput.value = '';
    devModal.classList.remove('hidden');
    setTimeout(() => devInput.focus(), 80);
  };
  devModal.querySelector('.confirm-backdrop').onclick = () => devModal.classList.add('hidden');
  devModal.querySelector('#dev-access-cancel').onclick = () => devModal.classList.add('hidden');
  const tryUnlock = () => {
    if (tryUnlockDev(devInput.value.trim())) {
      haptic('heavy');
      devModal.classList.add('hidden');
      render();
    } else {
      haptic('medium');
      devErr.classList.remove('hidden');
      const card = devModal.querySelector('.dev-access-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  };
  devModal.querySelector('#dev-access-unlock').onclick = tryUnlock;
  devInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
}

function wireDevTools() {
  if (!isDevUnlocked()) return;

  const confirmModal = screenEl.querySelector('#dev-confirm-modal');
  const confirmTitle = confirmModal.querySelector('#dev-confirm-title');
  const confirmBody  = confirmModal.querySelector('#dev-confirm-body');
  let confirmAction  = null;
  confirmModal.querySelector('.confirm-backdrop').onclick = () => confirmModal.classList.add('hidden');
  confirmModal.querySelector('#dev-confirm-cancel').onclick = () => confirmModal.classList.add('hidden');
  confirmModal.querySelector('#dev-confirm-ok').onclick = () => {
    if (confirmAction) confirmAction();
    confirmModal.classList.add('hidden');
  };
  const askConfirm = (title, body, action) => {
    confirmTitle.textContent = title;
    confirmBody.textContent  = body;
    confirmAction = action;
    confirmModal.classList.remove('hidden');
  };

  // Infinite Balance toggle
  const infBox = screenEl.querySelector('#dev-infinite-toggle');
  infBox.addEventListener('change', () => {
    setInfiniteBalance(infBox.checked);
    haptic('medium');
    sfx.click();
    _hooks.onInfiniteToggled?.(infBox.checked);
  });

  // Action buttons
  screenEl.querySelectorAll('.dev-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic('soft');
      sfx.click();
      const act = btn.dataset.act;
      switch (act) {
        case 'add100':  addBalance(100);  _hooks.onBalanceChanged?.(); break;
        case 'add500':  addBalance(500);  _hooks.onBalanceChanged?.(); break;
        case 'add1000': addBalance(1000); _hooks.onBalanceChanged?.(); break;
        case 'refreshVendors':
          regenerateAllVendorStocks();
          _hooks.onVendorsChanged?.();
          break;
        case 'refreshMarket':
          runRefresh();
          _hooks.onMarketRefreshed?.();
          break;
        case 'forceBroker':
          localStorage.setItem('tcg_dev_force_broker', 'true');
          regenerateVendorStock('broker');
          _hooks.onVendorsChanged?.();
          break;
        case 'resetRep':
          askConfirm('Reset reputation?', 'All collector rank progress will be cleared.', () => {
            localStorage.removeItem('tcg_reputation');
            _hooks.onReputationReset?.();
          });
          break;
        case 'resetEconomy':
          askConfirm('Reset economy?', 'Market values, vendor stocks, trends, and chase will all be regenerated.', () => {
            ['tcg_economy','tcg_market_values','tcg_market_meta','tcg_vendor_stocks',
             'tcg_chase','tcg_broker_inv'].forEach(k => localStorage.removeItem(k));
            location.reload();
          });
          break;
        case 'clearMarketHistory':
          askConfirm('Clear market history?', 'All market sparkline and graph history will be erased.', () => {
            clearHistory();
            _hooks.onMarketRefreshed?.();
          });
          break;
        case 'lockDev':
          askConfirm('Lock Developer Access?', 'Dev tools and infinite balance will be turned off.', () => {
            lockDev();
            _hooks.onInfiniteToggled?.(false);
            render();
          });
          break;
      }
    });
  });
}

function wireDiagnostics() {
  if (!isDevUnlocked()) return;

  // Collapsible toggle
  const diagToggle = screenEl.querySelector('#diag-section-toggle');
  const diagBody   = screenEl.querySelector('#diag-section-body');
  const diagChev   = screenEl.querySelector('#diag-chevron');
  if (diagToggle && diagBody) {
    diagToggle.addEventListener('click', () => {
      const open = diagBody.classList.toggle('diag-body-open');
      diagChev.textContent = open ? '▴' : '▾';
      haptic('soft');
    });
  }

  // Master toggle
  const masterCb = screenEl.querySelector('#diag-master-toggle');
  if (masterCb) {
    masterCb.addEventListener('change', () => {
      setDiagnosticsEnabled(masterCb.checked);
      haptic('medium');
      sfx.click();
      applyDiagnosticsState();
      // Re-render to reflect sub-option enabled/disabled states
      const scrollPos = screenEl.querySelector('.settings-body')?.scrollTop ?? 0;
      render();
      // Reopen the diagnostics section after re-render
      const newBody = screenEl.querySelector('#diag-section-body');
      const newChev = screenEl.querySelector('#diag-chevron');
      if (newBody) { newBody.classList.add('diag-body-open'); newChev.textContent = '▴'; }
      screenEl.querySelector('.settings-body')?.scrollTo(0, scrollPos);
    });
  }

  // Overlay toggle
  const overlayCb = screenEl.querySelector('#diag-overlay-toggle');
  if (overlayCb) {
    overlayCb.addEventListener('change', () => {
      setDiagFlag('showOverlay', overlayCb.checked);
      haptic('soft');
      applyDiagnosticsState();
    });
  }

  // Debug Tap toggle
  const tapCb = screenEl.querySelector('#diag-tap-toggle');
  if (tapCb) {
    tapCb.addEventListener('change', () => {
      setDiagFlag('showDebugTap', tapCb.checked);
      haptic('soft');
      applyDiagnosticsState();
    });
  }

  // Tracing sub-flags (require reload — just persist)
  [
    ['#diag-touchtrace-toggle', 'touchTrace'],
    ['#diag-navaudit-toggle',   'navAudit'],
    ['#diag-audioDiag-toggle',  'audioDiag'],
  ].forEach(([sel, key]) => {
    const cb = screenEl.querySelector(sel);
    if (!cb) return;
    cb.addEventListener('change', () => {
      setDiagFlag(key, cb.checked);
      haptic('soft');
    });
  });

  // Subsystem isolation toggles (require reload)
  const reloadRow = screenEl.querySelector('#diag-reload-row');
  screenEl.querySelectorAll('.diag-iso-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.iso;
      const cur = getDiagIsolation();
      cur[key] = cb.checked;
      setDiagIsolation(cur);
      haptic('soft');
      // Show reload notice if any flag is active
      const anyOn = Object.values(getDiagIsolation()).some(Boolean);
      reloadRow?.classList.toggle('diag-reload-visible', anyOn);
    });
  });

  // Reload button
  screenEl.querySelector('#diag-reload-btn')?.addEventListener('click', () => {
    haptic('heavy');
    location.reload();
  });
}

function render() {
  const s    = getSettings();
  const dev  = isDevUnlocked();
  screenEl.innerHTML = getSettingsHTML(s, dev);

  wireBaseSettings();
  wireResetModal();
  wireDevAccess();
  wireDevTools();
  wireDiagnostics();
}

export function openSettingsScreen() {
  screenEl = document.getElementById('settings-screen');
  if (!screenEl) return;
  render();
  screenEl.style.display = 'flex';
  requestAnimationFrame(() => screenEl.classList.remove('hidden'));
  lockBodyScroll();
}

export function closeSettingsScreen() {
  if (!screenEl) return;
  screenEl.classList.add('hidden');
  setTimeout(() => {
    if (screenEl.classList.contains('hidden')) screenEl.style.display = 'none';
  }, 240);
  unlockBodyScroll();
}
