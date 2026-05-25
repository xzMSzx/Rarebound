const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toDeg = (value) => `${value.toFixed(2)}deg`;
const pointerPercent = (position, length) => clamp(position / length, 0, 1);

export class HoloController {
  constructor(root = document) {
    this.root = root;
    this.cards = new Map();
    this._rafId = null;
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
      qualityMax: card.dataset.qualityTier === 'low' ? 8 : 12,
    };

    const observer = new ResizeObserver(() => this._updateBounds(state));
    observer.observe(translater);
    state.observer = observer;

    this.cards.set(card, state);
    this._updateBounds(state);

    card.addEventListener('pointermove', (event) => {
      if (card.dataset.cardState === 'idle' || card.dataset.rbInteractive === 'false') return;
      state.lastPointer = { x: event.clientX, y: event.clientY };
      state.dirty = true;
      this._requestFlush();
    }, { passive: true });

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

  _flush() {
    this._rafId = null;

    this.cards.forEach((state) => {
      if (!state.dirty || !state.bounds) return;

      let pointerX = 0.5;
      let pointerY = 0.5;
      let rotateX = '0deg';
      let rotateY = '0deg';

      if (state.lastPointer) {
        pointerX = pointerPercent(state.lastPointer.x - state.bounds.left, state.bounds.width);
        pointerY = pointerPercent(state.lastPointer.y - state.bounds.top, state.bounds.height);

        const normalizedX = pointerX - 0.5;
        const normalizedY = pointerY - 0.5;
        const resistanceX = 1 - Math.min(0.18, Math.abs(normalizedX) * 0.18);
        const resistanceY = 1 - Math.min(0.18, Math.abs(normalizedY) * 0.18);
        const rawRotateY = normalizedX * state.qualityMax * resistanceX;
        const rawRotateX = -normalizedY * state.qualityMax * resistanceY;

        rotateX = toDeg(clamp(rawRotateX, -state.qualityMax, state.qualityMax));
        rotateY = toDeg(clamp(rawRotateY, -state.qualityMax, state.qualityMax));
      }

      state.translater.style.setProperty('--rb-pointer-x', `${pointerX * 100}%`);
      state.translater.style.setProperty('--rb-pointer-y', `${pointerY * 100}%`);
      state.translater.style.setProperty('--rb-rotate-x', rotateX);
      state.translater.style.setProperty('--rb-rotate-y', rotateY);
      state.dirty = false;
    });
  }
}
