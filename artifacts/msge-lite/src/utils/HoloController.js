import { SpringValue } from '../../ui/springValue.js';
import { getTierCapabilities } from '../../ui/renderTiers.js';
import { diagnosticOverlay } from '../../ui/diagnosticOverlay.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toDeg = (value) => `${value.toFixed(2)}deg`;
const pointerPercent = (position, length) => clamp(position / length, 0, 1);

export class HoloController {
  constructor(root = document) {
    this.root = root;
    this.cards = new Map();
    this._rafId = null;
    this._lastFrameTime = null;
    this._boundFlush = this._flush.bind(this);
    this._init();
    diagnosticOverlay.attachHoloController(this);
  }

  _init() {
    const cards = [];
    if (this.root?.nodeType === 1 && this.root.matches('[data-rb-interactive="true"]')) {
      cards.push(this.root);
    }
    cards.push(...Array.from(this.root.querySelectorAll('[data-rb-interactive="true"]')));
    cards.forEach((card) => this.registerCard(card));
    window.addEventListener('resize', () => this._refreshBounds(), { passive: true });
  }

  // Public method so new cards can be registered dynamically
  registerCard(card) {
    if (this.cards.has(card)) return;

    const animator = card.querySelector('.card__animator');
    const translater = card.querySelector('.card__translater');
    const glare = card.querySelector('.card__glare');
    const shine = card.querySelector('.card__shine');
    if (!animator || !translater) {
      console.warn('[HoloController] Skipping card with incomplete holo rig', {
        card,
        animator,
        translater,
        glare,
        shine,
      });
      return;
    }

    const tierNode = card.closest('[data-render-tier]');
    const tier = tierNode ? tierNode.dataset.renderTier : null;
    const capabilities = getTierCapabilities(tier);
    if (!capabilities.tilt) return;

    const state = {
      card,
      animator,
      translater,
      glare,
      shine,
      capabilities,
      tier,
      bounds: null,
      lastPointer: null,
      dirty: true,
      // DEBUG: temporarily amplify rotation range for visual verification
      // Set to 22 during tuning; revert to original logic after verification
      qualityMax: window.matchMedia?.('(max-width: 700px)')?.matches ? 12 : 22,
      rotationSpring: new SpringValue(
        { x: 0, y: 0 },
        { stiffness: 0.38, damping: 0.78, precision: 0.001 }
      ),
      interactionSpring: new SpringValue(
        { tiltX: 0.5, tiltY: 0.5, angle: 0, fromCenter: 0, atEdge: 0 },
        { stiffness: 0.38, damping: 0.78, precision: 0.001 }
      ),
    };

    const observer = new ResizeObserver(() => this._updateBounds(state));
    observer.observe(translater);
    state.observer = observer;

    this.cards.set(card, state);
    this._updateBounds(state);

    let disengageTimer = null;

    const cancelDisengage = () => {
      if (disengageTimer) {
        clearTimeout(disengageTimer);
        disengageTimer = null;
      }
    };

    const scheduleDisengage = () => {
      cancelDisengage();
      disengageTimer = setTimeout(() => {
        state.lastPointer = null;
        state.dirty = true;
        this._requestFlush();
      }, 120);
    };

    const onPointerDown = (event) => {
      if (card.dataset.cardState === 'idle' || card.dataset.rbInteractive === 'false' || !state.capabilities.tilt) return;
      event.preventDefault();
      card.setPointerCapture?.(event.pointerId);
      cancelDisengage();
      state.lastPointer = { x: event.clientX, y: event.clientY };
      state.dirty = true;
      this._requestFlush();
    };

    const onPointerMove = (event) => {
      if (card.dataset.cardState === 'idle' || card.dataset.rbInteractive === 'false' || !state.capabilities.tilt) return;
      event.preventDefault();
      cancelDisengage();
      state.lastPointer = { x: event.clientX, y: event.clientY };
      state.dirty = true;
      this._requestFlush();
    };

    const onPointerUp = (event) => {
      card.releasePointerCapture?.(event.pointerId);
      scheduleDisengage();
    };

    const onPointerCancel = () => scheduleDisengage();
    const onLostPointerCapture = () => scheduleDisengage();
    const onDragStart = (event) => event.preventDefault();
    const onPointerLeave = scheduleDisengage;
    const onPointerOut = scheduleDisengage;
    const onTouchMove = (event) => {
      if (tier === 'showcase' || tier === 'interactive') {
        event.preventDefault();
      }
    };

    card.addEventListener('pointerdown', onPointerDown, { passive: false });
    card.addEventListener('pointermove', onPointerMove, { passive: false });
    card.addEventListener('pointerup', onPointerUp, { passive: true });
    card.addEventListener('pointercancel', onPointerCancel, { passive: true });
    card.addEventListener('lostpointercapture', onLostPointerCapture, { passive: true });
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('pointerleave', onPointerLeave, { passive: true });
    card.addEventListener('pointerout', onPointerOut, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: false });

    state.cleanup = () => {
      observer.disconnect();
      card.removeEventListener('pointerdown', onPointerDown);
      card.removeEventListener('pointermove', onPointerMove);
      card.removeEventListener('pointerup', onPointerUp);
      card.removeEventListener('pointercancel', onPointerCancel);
      card.removeEventListener('lostpointercapture', onLostPointerCapture);
      card.removeEventListener('dragstart', onDragStart);
      card.removeEventListener('pointerleave', onPointerLeave);
      card.removeEventListener('pointerout', onPointerOut);
      card.removeEventListener('touchmove', onTouchMove);
    };
  }

  unregisterCard(card) {
    const state = this.cards.get(card);
    if (!state) return;

    if (state.cleanup) state.cleanup();
    this.cards.delete(card);
  }

  _updateBounds(state) {
    const rect = state.translater.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      state.bounds = rect;
      state.dirty = true;
      this._requestFlush();
    }
  }

  _refreshBounds() {
    this.cards.forEach((state) => this._updateBounds(state));
  }

  _requestFlush() {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(this._boundFlush);
  }

  _flush(timestamp) {
    this._rafId = null;
    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    const dt = this._lastFrameTime !== null ? Math.min((now - this._lastFrameTime) / 1000, 0.033) : 0.016;
    this._lastFrameTime = now;

    this.cards.forEach((state) => {
      if (!state.bounds) return;

      let pointerX = 0.5;
      let pointerY = 0.5;
      let rawRotateX = 0;
      let rawRotateY = 0;
      let targetInteraction = {
        tiltX: 0.5,
        tiltY: 0.5,
        angle: 0,
        fromCenter: 0,
        atEdge: 0,
      };

      if (state.lastPointer || state.dirty) {
        // default to center (0) so springs return to rest when pointer leaves
        let targetNormX = 0;
        let targetNormY = 0;
        if (state.lastPointer) {
          // ACTIVE INTERACTION: Pure smoothing, zero velocity accumulation
          // Prevents aggressive rebound/whip on fast direction changes
          state.rotationSpring.velocity = { x: 0, y: 0 };
          state.interactionSpring.velocity = { tiltX: 0, tiltY: 0, angle: 0, fromCenter: 0, atEdge: 0 };

          state.rotationSpring.stiffness = 0.35;
          state.rotationSpring.damping = 1.0;
          state.interactionSpring.stiffness = 0.35;
          state.interactionSpring.damping = 1.0;

          pointerX = pointerPercent(state.lastPointer.x - state.bounds.left, state.bounds.width);
          pointerY = pointerPercent(state.lastPointer.y - state.bounds.top, state.bounds.height);

          // Map pointer [0,1] -> centered [-1,1] for full-degree range
          const centeredX = (pointerX - 0.5) * 2;
          const centeredY = (pointerY - 0.5) * 2;
          const normalizedDistance = clamp(Math.hypot(centeredX, centeredY) / Math.SQRT2, 0, 1);
          const edgeProximity = clamp(Math.max(Math.abs(centeredX), Math.abs(centeredY)), 0, 1);
          const angle = (() => {
            const radians = Math.atan2(centeredY, centeredX);
            const degrees = radians * (180 / Math.PI);
            return degrees < 0 ? degrees + 360 : degrees;
          })();

          const resistanceX = 1 - Math.min(0.18, Math.abs(centeredX) * 0.18);
          const resistanceY = 1 - Math.min(0.18, Math.abs(centeredY) * 0.18);
          // Use normalized centered targets for the spring (-1..1), multiply
          // by qualityMax *after* the spring to produce degrees. This keeps
          // spring values meaningful and avoids tiny degree-step integration.
          targetNormX = centeredY * -resistanceY;
          targetNormY = centeredX * resistanceX;

          targetInteraction = {
            tiltX: pointerX,
            tiltY: pointerY,
            angle,
            fromCenter: normalizedDistance,
            atEdge: edgeProximity,
          };
        } else {
          // DISENGAGE / RELEASE: Calm, distance-aware ease-out (lerp)
          state.rotationSpring.velocity = { x: 0, y: 0 };
          state.interactionSpring.velocity = { tiltX: 0, tiltY: 0, angle: 0, fromCenter: 0, atEdge: 0 };
          
          const rotX = state.rotationSpring.current.x || 0;
          const rotY = state.rotationSpring.current.y || 0;
          const tiltMag = clamp(Math.hypot(rotX, rotY), 0, 1);
          
          // Distance-scaled stiffness: 
          // Small tilt -> ~0.14 stiffness (faster return)
          // Large tilt -> ~0.04 stiffness (longer, graceful glide)
          const releaseStiffness = 0.04 + ((1 - tiltMag) * 0.10);
          
          state.rotationSpring.stiffness = releaseStiffness;
          state.rotationSpring.damping = 1.0;
          state.interactionSpring.stiffness = releaseStiffness;
          state.interactionSpring.damping = 1.0;
        }

        state.rotationSpring.setTarget({ x: targetNormX, y: targetNormY });
        state.interactionSpring.setTarget(targetInteraction);
        state.rotationSpring.update(dt);
        state.interactionSpring.update(dt);

        const rotation = state.rotationSpring.current;
        const interaction = state.interactionSpring.current;

        // 4. Dispatch to the DOM (Simey-Compatible Format)
        state.translater.style.setProperty('--rb-tilt-x', `${interaction.tiltX * 100}%`);
        state.translater.style.setProperty('--rb-tilt-y', `${interaction.tiltY * 100}%`);

        state.translater.style.setProperty('--rb-from-left', interaction.tiltX); // Raw decimal
        state.translater.style.setProperty('--rb-from-top', interaction.tiltY); // Raw decimal

        state.translater.style.setProperty('--rb-from-center', interaction.fromCenter);
        state.translater.style.setProperty('--rb-at-edge', interaction.atEdge);

        // Capability driven rendering
        // Reduce base glare when the card is idle/near-center,
        // but preserve full glare response as pointer moves outward.
        const glareOpacity = state.capabilities.glare
          ? 0.35 + 0.65 * interaction.fromCenter
          : 0;
        state.translater.style.setProperty('--rb-glare-opacity', glareOpacity);
        
        // Dynamic Idle Shine Tuning:
        // Lerp shine opacity from 0.10 (at center / idle) to 1.00 (at outer edge)
        const shineOpacity = state.capabilities.holo ? (0.10 + 0.90 * interaction.fromCenter) : 0;
        state.translater.style.setProperty('--rb-shine-opacity', shineOpacity);
        // rotation.x/y are normalized (-1..1) from the spring — scale to degrees
        const degX = clamp(rotation.x, -1, 1) * state.qualityMax;
        const degY = clamp(rotation.y, -1, 1) * state.qualityMax;
        state.translater.style.setProperty('--rb-rotate-x', toDeg(degX));
        state.translater.style.setProperty('--rb-rotate-y', toDeg(degY));
        state.translater.style.setProperty('--rb-pointer-x', `${pointerX * 100}%`);
        state.translater.style.setProperty('--rb-pointer-y', `${pointerY * 100}%`);

        // Additional variables for Illustration Rare
        state.translater.style.setProperty('--rb-pointer-from-center', interaction.fromCenter);
        state.translater.style.setProperty('--rb-pointer-from-left', interaction.tiltX);
        state.translater.style.setProperty('--rb-pointer-from-top', interaction.tiltY);

        // Calculate background position based on interaction (typically inverted or scaled)
        const bgX = 50 + (interaction.tiltX - 0.5) * 50;
        const bgY = 50 + (interaction.tiltY - 0.5) * 50;
        state.translater.style.setProperty('--rb-background-x', `${bgX}%`);
        state.translater.style.setProperty('--rb-background-y', `${bgY}%`);

        const isRotationRest = state.rotationSpring.isAtRest();
        const isInteractionRest = state.interactionSpring.isAtRest();
        state.dirty = !isRotationRest || !isInteractionRest;
      }

      if (state.dirty) {
        this._requestFlush();
      }
    });
  }
}
