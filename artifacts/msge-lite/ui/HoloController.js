import { SpringValue } from './springValue.js';

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
  }

  _init() {
    const cards = Array.from(this.root.querySelectorAll('[data-rb-interactive="true"]'));
    cards.forEach((card) => this._registerCard(card));
    window.addEventListener('resize', () => this._refreshBounds(), { passive: true });
  }

  _registerCard(card) {
    if (this.cards.has(card)) return;

    const translater = card.querySelector('.card__translater');
    if (!translater) return;

    const state = {
      card,
      translater,
      bounds: null,
      lastPointer: null,
      dirty: true,
      // DEBUG: temporarily amplify rotation range for visual verification
      // Set to 22 during tuning; revert to original logic after verification
      qualityMax: 22,
      rotationSpring: new SpringValue(
        { x: 0, y: 0 },
        { stiffness: 0.38, damping: 0.72, precision: 0.001 }
      ),
      interactionSpring: new SpringValue(
        { tiltX: 0.5, tiltY: 0.5, angle: 0, fromCenter: 0, atEdge: 0 },
        { stiffness: 0.32, damping: 0.8, precision: 0.001 }
      ),
    };

    const observer = new ResizeObserver(() => this._updateBounds(state));
    observer.observe(translater);
    state.observer = observer;

    this.cards.set(card, state);
    this._updateBounds(state);

    card.addEventListener('pointerdown', (event) => {
      if (card.dataset.cardState === 'idle' || card.dataset.rbInteractive === 'false') return;
      event.preventDefault();
      card.setPointerCapture?.(event.pointerId);
      state.lastPointer = { x: event.clientX, y: event.clientY };
      state.dirty = true;
      this._requestFlush();
    }, { passive: false });

    card.addEventListener('pointermove', (event) => {
      if (card.dataset.cardState === 'idle' || card.dataset.rbInteractive === 'false') return;
      event.preventDefault();
      state.lastPointer = { x: event.clientX, y: event.clientY };
      state.dirty = true;
      this._requestFlush();
    }, { passive: false });

    card.addEventListener('pointerup', (event) => {
      card.releasePointerCapture?.(event.pointerId);
      state.lastPointer = null;
      state.dirty = true;
      this._requestFlush();
    }, { passive: true });

    card.addEventListener('pointercancel', () => {
      state.lastPointer = null;
      state.dirty = true;
      this._requestFlush();
    }, { passive: true });

    card.addEventListener('lostpointercapture', () => {
      state.lastPointer = null;
      state.dirty = true;
      this._requestFlush();
    }, { passive: true });

    card.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });

    const reset = () => {
      state.lastPointer = null;
      state.dirty = true;
      this._requestFlush();
    };

    card.addEventListener('pointerleave', reset, { passive: true });
    card.addEventListener('pointerout', reset, { passive: true });
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
          targetNormX = centeredX * resistanceX;
          targetNormY = centeredY * resistanceY;

          targetInteraction = {
            tiltX: pointerX,
            tiltY: pointerY,
            angle,
            fromCenter: normalizedDistance,
            atEdge: edgeProximity,
          };
        }

        state.rotationSpring.setTarget({ x: targetNormX, y: targetNormY });
        state.interactionSpring.setTarget(targetInteraction);
        state.rotationSpring.update(dt);
        state.interactionSpring.update(dt);

        const rotation = state.rotationSpring.current;
        const interaction = state.interactionSpring.current;

        state.translater.style.setProperty('--rb-tilt-x', `${interaction.tiltX}`);
        state.translater.style.setProperty('--rb-tilt-y', `${interaction.tiltY}`);
        state.translater.style.setProperty('--rb-angle', `${interaction.angle.toFixed(2)}deg`);
        state.translater.style.setProperty('--rb-from-center', `${interaction.fromCenter}`);
        state.translater.style.setProperty('--rb-at-edge', `${interaction.atEdge}`);
        // rotation.x/y are normalized (-1..1) from the spring — scale to degrees
        const degX = clamp(rotation.x, -1, 1) * state.qualityMax;
        const degY = clamp(rotation.y, -1, 1) * state.qualityMax;
        state.translater.style.setProperty('--rb-rotate-x', toDeg(degX));
        state.translater.style.setProperty('--rb-rotate-y', toDeg(degY));
        state.translater.style.setProperty('--rb-pointer-x', `${pointerX * 100}%`);
        state.translater.style.setProperty('--rb-pointer-y', `${pointerY * 100}%`);

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
