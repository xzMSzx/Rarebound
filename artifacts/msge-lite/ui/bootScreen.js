/**
 * ui/bootScreen.js — Phase 10
 *
 * Premium startup overlay. Replaces the old top-left "Preloading packs…"
 * text with a full-screen identity moment (RAREBOUND title + tagline +
 * loading bar + rotating real preload stage labels).
 *
 * The Vendor Hub is non-interactive (pointer-events: none) until preload
 * resolves and the boot screen has fully faded out.
 */

const STAGES = [
  { label: 'Restoring collection…',     pct: 12 },
  { label: 'Syncing vendor inventory…', pct: 28 },
  { label: 'Loading market trends…',    pct: 44 },
  { label: 'Preparing pack archives…',  pct: 72 },
  { label: 'Building binder pages…',    pct: 88 },
  { label: 'Finalizing economy…',       pct: 100 },
];

let bootEl, barFillEl, stageLabelEl;

function ensureMounted() {
  if (bootEl) return;
  bootEl = document.getElementById('boot-screen');
  if (!bootEl) return;
  barFillEl    = bootEl.querySelector('.boot-bar-fill');
  stageLabelEl = bootEl.querySelector('.boot-stage-label');
}

export function showBootScreen() {
  ensureMounted();
  if (!bootEl) return;
  bootEl.classList.remove('boot-fade-out');
  bootEl.style.display = 'flex';
  // Lock the underlying app from interaction during boot
  document.body.classList.add('boot-locked');
}

function setStage(stage) {
  if (!stageLabelEl || !barFillEl) return;
  stageLabelEl.textContent = stage.label;
  barFillEl.style.width    = stage.pct + '%';
}

/**
 * Runs the boot sequence with REAL stage progression.
 * Each stage `awaits` the work it represents so users see truthful progress.
 *
 * @param {Object} ops
 * @param {() => void}                 ops.restoreCollection
 * @param {() => void}                 ops.syncVendors
 * @param {() => void}                 ops.loadMarket
 * @param {() => Promise<unknown>}     ops.checkPendingSession
 * @param {() => Promise<unknown>}     ops.checkVersion
 * @param {() => Promise<unknown>}     ops.preloadPacks
 * @param {() => Promise<unknown>}     ops.hydrateBinders
 * @param {() => void}                 ops.finalizeEconomy
 */
export async function runBootSequence(ops) {
  ensureMounted();
  
  if (!bootEl) {
    try { ops.restoreCollection?.(); } catch {}
    try { ops.syncVendors?.(); } catch {}
    try { ops.loadMarket?.(); } catch {}
    try { await ops.checkPendingSession?.(); } catch {}
    try { await ops.checkVersion?.(); } catch {}
    try { await ops.preloadPacks?.(); } catch {}
    try { await ops.hydrateBinders?.(); } catch {}
    try { ops.finalizeEconomy?.(); } catch {}
    return;
  }

  // Minimum visible time so the boot screen reads as intentional, not a flash.
  const minVisibleMs = 1500;
  const startedAt = performance.now();

  const rAF = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  setStage(STAGES[0]); try { ops.restoreCollection?.(); } catch {} await rAF();
  setStage(STAGES[1]); try { ops.syncVendors?.();       } catch {} await rAF();
  setStage(STAGES[2]); try { ops.loadMarket?.();        } catch {} await rAF();

  // We weave the new checks in before heavy preload, but don't add stages for them.
  try { await ops.checkPendingSession?.(); } catch {}
  try { await ops.checkVersion?.(); } catch {}

  setStage(STAGES[3]);
  try { await ops.preloadPacks?.(); } catch {}

  setStage(STAGES[4]);
  try { await ops.hydrateBinders?.(); } catch {}

  setStage(STAGES[5]); try { ops.finalizeEconomy?.(); } catch {} await rAF();

  // Ensure minimum visible duration
  const elapsed = performance.now() - startedAt;
  if (elapsed < minVisibleMs) {
    await new Promise(r => setTimeout(r, minVisibleMs - elapsed));
  }

  await hideBootScreen();
}

export async function hideBootScreen() {
  ensureMounted();
  if (!bootEl) return;
  bootEl.classList.add('boot-fade-out');
  await new Promise(r => setTimeout(r, 480));
  bootEl.style.display = 'none';
  document.body.classList.remove('boot-locked');
}
