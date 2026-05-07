/**
 * ui/mysteryBoxOverlay.js — Phase 10.1
 *
 * Lightweight reveal modal for opening a mystery box. Shows three sealed
 * pack tiles that flip one-by-one to reveal which sets were drawn.
 * The host (main.js) then sequentially opens those packs via the
 * existing pack-opening flow — we never touch the cinematic pack
 * controller from here.
 */

import { haptic } from '../data/hapticManager.js';
import { sfx } from '../data/ambientAudioManager.js';
import { PACK_STORE } from '../data/packStore.js';
import { lockBodyScroll, unlockBodyScroll } from './scrollManager.js';

let overlayEl;

function ensureOverlay() {
  overlayEl = document.getElementById('mystery-box-overlay');
  return !!overlayEl;
}

/**
 * Run the reveal animation for a rolled box. Returns a Promise that
 * resolves with the same setIds once the user taps "Open packs" so the
 * caller can chain into pack opening.
 */
export function showMysteryBoxReveal(box, setIds) {
  return new Promise((resolve) => {
    if (!ensureOverlay()) return resolve(setIds);

    const tiles = setIds.map((id, i) => {
      const pack = PACK_STORE[id];
      const art  = pack ? `${import.meta.env.BASE_URL}${pack.art}` : '';
      return `
        <div class="mystery-tile" data-i="${i}">
          <div class="mystery-tile-inner">
            <div class="mystery-tile-back">?</div>
            <div class="mystery-tile-front">
              ${art ? `<img src="${art}" alt="${pack?.name || id}" />` : ''}
              <div class="mystery-tile-label">${pack?.name || id}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    overlayEl.innerHTML = `
      <div class="mystery-backdrop"></div>
      <div class="mystery-card">
        <div class="mystery-eyebrow">${box.name}</div>
        <div class="mystery-headline">Sealed Reveal</div>
        <div class="mystery-tiles">${tiles}</div>
        <button class="mystery-open-btn" id="mystery-open-btn" disabled>Revealing…</button>
      </div>
    `;
    overlayEl.classList.remove('hidden');
    overlayEl.style.display = 'flex';
    lockBodyScroll();

    const tileEls  = overlayEl.querySelectorAll('.mystery-tile');
    const openBtn  = overlayEl.querySelector('#mystery-open-btn');

    // Stagger flip reveals
    tileEls.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('is-flipped');
        haptic('soft');
      }, 350 + i * 380);
    });

    // Enable button after all reveals
    setTimeout(() => {
      sfx.boxSeal();
      openBtn.disabled = false;
      openBtn.textContent = 'Open Packs';
    }, 350 + tileEls.length * 380 + 200);

    const close = (deliver) => {
      overlayEl.classList.add('hidden');
      setTimeout(() => {
        if (overlayEl.classList.contains('hidden')) overlayEl.style.display = 'none';
      }, 240);
      unlockBodyScroll();
      resolve(deliver ? setIds : null);
    };

    openBtn.onclick = () => {
      haptic('medium');
      close(true);
    };
    overlayEl.querySelector('.mystery-backdrop').onclick = () => close(false);
  });
}
