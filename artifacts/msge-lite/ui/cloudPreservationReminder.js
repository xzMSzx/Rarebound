import { getActiveProfileId } from '../data/profileStorage.js';
import { uploadCloudSave } from '../data/supabase.js';

const COOLDOWN_KEY = 'rb_last_preservation_prompt';
const COOLDOWN_HOURS = 4;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

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

export function triggerPreservationCheck(progressionType) {
  const activeProfile = getActiveProfileId();
  if (activeProfile === 'guest') return; // Only for authenticated users

  const key = `rb_profile_${activeProfile}_${COOLDOWN_KEY}`;
  const lastPrompt = parseInt(localStorage.getItem(key) || '0', 10);
  const now = Date.now();

  if (now - lastPrompt < COOLDOWN_MS) {
    return; // Cooldown not expired
  }

  showPreservationModal(key, now);
}

function showPreservationModal(flagKey, now) {
  // Prevent multiple overlapping modals
  if (document.getElementById('cloud-preservation-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'cloud-preservation-modal';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.6s ease';
  overlay.style.pointerEvents = 'all';

  overlay.innerHTML = `
    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);"></div>
    <div style="position: relative; text-align: center; width: 340px; padding: 2.5rem 2rem; border-radius: 8px; background: var(--ags-bg-elev); border: 1px solid var(--ags-gold-soft); box-shadow: 0 12px 40px rgba(0,0,0,0.6); transform: translateY(10px); transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
      <div style="margin-bottom: 1.5rem;">
        <div style="color: var(--ags-gold); text-transform: uppercase; letter-spacing: 0.15em; font-size: 0.65rem; font-weight: bold; margin-bottom: 0.5rem; opacity: 0.8;">Cloud Archive</div>
        <div style="font-family: var(--font-brand); color: var(--text-base); font-size: 1.25rem; letter-spacing: 0.02em;">Preservation Recommended</div>
      </div>
      
      <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 2rem;">
        Your archive has changed since the last cloud preservation.<br><br>
        <span style="opacity: 0.7;">Recent collector activity has not yet been archived to the cloud.</span>
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button id="btn-preserve-now" style="width: 100%; display: flex; align-items: center; justify-content: center; background: var(--ags-gold); color: #000; border: none; padding: 0.75rem; border-radius: 999px; font-weight: bold; font-size: 0.9rem; letter-spacing: 0.05em; cursor: pointer; transition: opacity 0.2s;">
          Preserve Archive
        </button>
        <button id="btn-preserve-later" style="width: 100%; display: flex; align-items: center; justify-content: center; background: transparent; color: var(--text-muted); border: 1px solid var(--ags-line); padding: 0.75rem; border-radius: 999px; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;">
          Later
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.querySelector('div:nth-child(2)').style.transform = 'translateY(0)';
  });

  const btnPreserve = overlay.querySelector('#btn-preserve-now');
  const btnLater = overlay.querySelector('#btn-preserve-later');

  const close = () => {
    overlay.style.opacity = '0';
    overlay.querySelector('div:nth-child(2)').style.transform = 'translateY(10px)';
    setTimeout(() => overlay.remove(), 600);
  };

  iosTap(btnPreserve, async () => {
    btnPreserve.disabled = true;
    btnLater.disabled = true;
    btnPreserve.textContent = 'Archiving...';
    btnPreserve.style.opacity = '0.7';

    try {
      const { error } = await uploadCloudSave();
      if (error) throw new Error(error.message);
      
      btnPreserve.textContent = 'Archive Secured';
      btnPreserve.style.background = 'var(--text-base)';
      
      // Update cooldown flag
      localStorage.setItem(flagKey, Date.now().toString());
      
      // Dispatch event to update "Last Preserved" UI anywhere if it's listening
      window.dispatchEvent(new Event('cloudPreservationComplete'));
      
      setTimeout(close, 1200);
    } catch (err) {
      btnPreserve.textContent = 'Preservation Failed';
      btnPreserve.style.background = '#883333';
      btnPreserve.style.color = '#fff';
      setTimeout(() => {
        btnPreserve.disabled = false;
        btnLater.disabled = false;
        btnPreserve.textContent = 'Preserve Archive';
        btnPreserve.style.background = 'var(--ags-gold)';
        btnPreserve.style.color = '#000';
        btnPreserve.style.opacity = '1';
      }, 2000);
    }
  });

  iosTap(btnLater, () => {
    // Save cooldown flag so we don't bother them immediately
    localStorage.setItem(flagKey, now.toString());
    close();
  });
}
