import { getTierCapabilities } from './renderTiers.js';

class DiagnosticOverlay {
  constructor() {
    this.panel = null;
    this.holoController = null;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.fps = 0;

    // Check if we are in development mode (e.g., location.hostname === 'localhost')
    this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('ngrok-free.app');

    if (this.isDev) {
      this.init();
    }
  }

  attachHoloController(hc) {
    this.holoController = hc;
  }

  init() {
    this.panel = document.createElement('div');
    this.panel.id = 'dev-diagnostic-overlay';
    this.panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #0f0;
      font-family: monospace;
      font-size: 11px;
      padding: 10px;
      border: 1px solid #0f0;
      z-index: 99999;
      pointer-events: none;
      min-width: 180px;
    `;

    document.body.appendChild(this.panel);

    const loop = () => {
      this.update();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  update() {
    if (!this.panel) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // Find the first card to inspect
    let activeCard = null;
    let cardState = null;

    if (this.holoController && this.holoController.cards.size > 0) {
      const iter = this.holoController.cards.values();
      cardState = iter.next().value;
      if (cardState) {
        activeCard = cardState.card;
      }
    }

    if (!activeCard) {
      activeCard = document.querySelector('.overlay-card-wrapper') || document.querySelector('.card');
    }

    let tier = 'none';
    let caps = { tilt: false, glare: false, holo: false, particles: false };

    if (activeCard) {
      const tierNode = activeCard.closest('[data-render-tier]');
      tier = tierNode ? tierNode.dataset.renderTier : 'unknown';
      caps = getTierCapabilities(tier);
    }

    const hcCount = this.holoController ? this.holoController.cards.size : 0;

    let pointerTracking = 'disabled';
    let rafLoop = 'stopped';

    if (this.holoController && this.holoController.cards.size > 0) {
      if (this.holoController._rafId !== null) {
        rafLoop = 'running';
      }

      if (cardState && cardState.lastPointer) {
        pointerTracking = 'active';
      } else if (cardState) {
        pointerTracking = 'idle';
      }
    }

    this.panel.innerHTML = `
      <div style="margin-bottom: 5px; border-bottom: 1px solid #0f0; padding-bottom: 3px;">RAREBOUND DIAGNOSTICS</div>
      <div>FPS: ${this.fps}</div>
      <div style="margin-top: 5px;">TIER: ${tier.toUpperCase()}</div>
      <div>CAPS:</div>
      <div>  tilt:      ${caps.tilt ? 'YES' : 'NO'}</div>
      <div>  glare:     ${caps.glare ? 'YES' : 'NO'}</div>
      <div>  holo:      ${caps.holo ? 'YES' : 'NO'}</div>
      <div>  particles: ${caps.particles ? 'YES' : 'NO'}</div>
      <div style="margin-top: 5px;">HOLO CONTROLLERS: ${hcCount}</div>
      <div>TRACKING: ${pointerTracking}</div>
      <div>RAF LOOP: ${rafLoop}</div>
    `;
  }
}

export const diagnosticOverlay = new DiagnosticOverlay();
