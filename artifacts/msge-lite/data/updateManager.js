import { APP_VERSION } from './settingsManager.js';

let updateModalShown = false;
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export async function checkUpdate() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`);
    if (!res.ok) return false;
    
    const data = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      showUpdateModal(data.version);
      return true;
    }
  } catch (err) {
    console.warn('[UpdateManager] Failed to check for updates:', err);
  }
  return false;
}

export function startBackgroundUpdateCheck() {
  setInterval(checkUpdate, CHECK_INTERVAL_MS);
}

function showUpdateModal(newVersion) {
  if (updateModalShown) return;
  
  const existing = document.getElementById('update-modal');
  if (existing) return;

  const modal = document.createElement('div');
  modal.id = 'update-modal';
  modal.className = 'screen modal-backdrop hidden';
  modal.style.zIndex = '9999';
  
  modal.innerHTML = `
    <div class="sell-modal-content" style="border: 1px solid rgba(212, 175, 55, 0.3); background: #111;">
      <div class="sell-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
        <div class="sell-card-info" style="text-align: center; width: 100%;">
          <div class="sell-card-name" style="color: #D4AF37; font-size: 20px;">Rarebound Updated</div>
          <div class="sell-card-rarity" style="color: #aaa; margin-top: 4px;">Version ${newVersion} Available</div>
        </div>
      </div>
      <div style="padding: 24px 20px; color: #eee; font-size: 15px; line-height: 1.5; text-align: center;">
        A new version of Rarebound is available.
      </div>
      <div class="sell-actions" style="margin-top: 8px; flex-direction: column; gap: 12px;">
        <button class="sell-confirm-btn" id="update-reload-btn" style="width: 100%; background: #D4AF37; color: #000;">Reload Now</button>
        <button class="sell-cancel-btn" id="update-later-btn" style="width: 100%;">Later</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const reloadBtn = modal.querySelector('#update-reload-btn');
  const laterBtn = modal.querySelector('#update-later-btn');
  
  const doReload = () => {
    window.location.reload();
  };
  const doLater = () => {
    modal.classList.add('hidden');
    setTimeout(() => modal.remove(), 300);
    updateModalShown = false;
  };
  
  reloadBtn.onclick = doReload;
  laterBtn.onclick = doLater;
  
  // Fast click mapping for mobile Safari
  reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doReload(); }, { passive: false });
  laterBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doLater(); }, { passive: false });
  
  updateModalShown = true;
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.remove('hidden'));
  });
}
