import { getActiveProfileId, setActiveProfileId } from '../data/profileStorage.js';
import { serializeToCanonicalSave, deserializeCanonicalSave } from '../persistence/saveSchemaAdapter.js';

const MIGRATION_FLAG_KEY = 'tcg_guest_migration_complete';

function iosTap(el, handler) {
  if (!el) return;
  let startX = 0, startY = 0, moved = false;
  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (dx * dx + dy * dy > 64) moved = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!moved) {
      e.preventDefault();
      handler();
    }
  }, { passive: false });
  el.onclick = handler;
}

function hasMeaningfulProgression(save) {
  if (!save) return false;
  
  if (save.collection?.inventory && Object.keys(save.collection.inventory).length > 0) return true;
  if (save.ags?.submissions && Object.keys(save.ags.submissions).length > 0) return true;
  if (save.history?.archiveHistory && save.history.archiveHistory.length > 0) return true;
  if (save.player?.progression?.reputation && Object.keys(save.player.progression.reputation).length > 0) return true;
  
  if (save.player?.profile?.balance !== undefined) {
    if (save.player.profile.balance !== 120 && typeof save.player.profile.balance === 'number') return true;
  }
  return false;
}

export function checkAndPromptMigration() {
  const currentProfile = getActiveProfileId();
  if (currentProfile === 'guest') return;

  const flagKey = `rb_profile_${currentProfile}_${MIGRATION_FLAG_KEY}`;
  if (localStorage.getItem(flagKey)) return;

  const authSave = serializeToCanonicalSave();
  if (hasMeaningfulProgression(authSave)) return;

  setActiveProfileId('guest');
  const guestSave = serializeToCanonicalSave();
  setActiveProfileId(currentProfile);

  if (hasMeaningfulProgression(guestSave)) {
    showMigrationModal(guestSave, currentProfile, flagKey);
  } else {
    localStorage.setItem(flagKey, 'true');
  }
}

function showMigrationModal(guestSave, currentProfile, flagKey) {
  const overlay = document.createElement('div');
  overlay.className = 'ags-modal-overlay';
  overlay.id = 'archive-migration-modal';
  overlay.style.zIndex = '9999';
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'all';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  overlay.innerHTML = `
    <div class="ags-modal__backdrop" style="position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);"></div>
    <div class="ags-modal__panel" style="position: relative; text-align: center; max-width: 400px; padding: 2.5rem 2rem; border-radius: 12px; background: var(--ags-bg-elev); border: 1px solid var(--ags-gold); box-shadow: 0 12px 40px rgba(0,0,0,0.5);">
      <div class="ags-modal__head" style="margin-bottom: 2rem;">
        <div class="ags-modal__brand" style="color: var(--ags-gold); text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.75rem; font-weight: bold; margin-bottom: 0.5rem;">Secure Migration Detected</div>
        <div class="ags-modal__title" style="font-family: var(--font-brand); color: var(--text-base); font-size: 1.5rem; letter-spacing: -0.01em;">Archive Preservation</div>
      </div>
      
      <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
        A local collector archive was detected on this device.
      </p>
      <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 2.5rem;">
        Would you like to transfer your archive into your Rarebound account? Your slabs, collection progress, archive history, curator reputation, and progression will be securely preserved.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button id="btn-migrate-archive" class="rb-pill" style="width: 100%; justify-content: center; background: var(--ags-gold); color: #000; border: none; padding: 0.75rem;">
          <span class="rb-pill-label" style="font-weight: bold;">Transfer Archive</span>
        </button>
        <button id="btn-migrate-fresh" class="rb-pill" style="width: 100%; justify-content: center; background: transparent; border: 1px solid var(--ags-line); padding: 0.75rem;">
          <span class="rb-pill-label" style="color: var(--text-muted);">Start Fresh</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnMigrate = overlay.querySelector('#btn-migrate-archive');
  const btnFresh = overlay.querySelector('#btn-migrate-fresh');

  iosTap(btnMigrate, () => {
    btnMigrate.disabled = true;
    btnFresh.disabled = true;
    btnMigrate.querySelector('.rb-pill-label').textContent = 'Transferring...';
    
    setTimeout(() => {
      const success = deserializeCanonicalSave(guestSave);
      if (success) {
        localStorage.setItem(flagKey, 'true');
        window.location.reload();
      } else {
        alert('Archive transfer failed. Please restart the application.');
        window.location.reload();
      }
    }, 500);
  });

  iosTap(btnFresh, () => {
    localStorage.setItem(flagKey, 'true');
    overlay.remove();
  });
}
