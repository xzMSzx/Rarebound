/**
 * ui/audioManager.js — Phase 5.6
 *
 * Synthesized SFX via the Web Audio API. No mp3 assets, no downloads, no
 * API keys, no licensing concerns — every sound is generated from oscillators
 * and noise buffers at runtime. Tiny, mobile-safe, and offline-capable.
 *
 * Public API:
 *   playCardFlip()    — short paper whoosh (every flip)
 *   playRareChime()   — rising 3-note arpeggio (rare → illustrationRare)
 *   playUltraHit()    — sub-bass thump + chime tail (ultraRare+)
 *   setSoundEnabled() / isSoundEnabled() — global mute toggle (default ON)
 *
 * Audio context is created lazily and unlocked on the first user interaction
 * (mobile browsers block audio until the user taps). The unlock listener
 * self-installs at module load and self-removes after firing.
 *
 * Trigger points (all in cardRevealAnimator.js revealCard):
 *   • Just before flip starts            → playCardFlip()
 *   • After flip lands, gated by realRarity:
 *       rare/holoRare/doubleRare/illRare  → playRareChime()
 *       ultraRare/special/hyper           → playUltraHit()
 */

let _ctx = null;
let _enabled = true;
let _noiseBuf = null;

function _getCtx() {
  if (_ctx) return _ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  _ctx = new Ctx();
  return _ctx;
}

/**
 * One-time unlock. Mobile Safari requires audio to be primed inside a user
 * gesture handler — calling ctx.resume() during a click satisfies that.
 * Safe to call repeatedly; no-ops once unlocked.
 */
function _unlock() {
  const ctx = _getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

// Self-install unlock listener (capture-phase, once). Touchstart for iOS,
// pointerdown for desktop/mouse, keydown so keyboard users also unlock.
['pointerdown', 'touchstart', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, _unlock, { once: true, passive: true, capture: true });
});

/** Lazily build a 1s mono white-noise buffer reused by every noise-based SFX. */
function _getNoiseBuffer() {
  if (_noiseBuf) return _noiseBuf;
  const ctx = _getCtx();
  if (!ctx) return null;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return _noiseBuf;
}

export function setSoundEnabled(on) { _enabled = !!on; }
export function isSoundEnabled()     { return _enabled; }

/* ─── SFX 1: card flip ───────────────────────────────────────────────────────
 * A short bandpass-filtered noise burst with a fast attack and ~80ms decay.
 * Reads as paper whisking through air. Fires on every flip regardless of
 * rarity, so it has to be subtle — peak gain capped at 0.18.
 */
export function suspendSFXAudio() {
  const ctx = _getCtx();
  if (ctx && ctx.state === 'running') {
    ctx.suspend().catch(() => {});
  }
}

export function resumeSFXAudio() {
  const ctx = _getCtx();
  if (ctx && ctx.state === 'suspended' && isSoundEnabled()) {
    ctx.resume().catch(() => {});
  }
}

export function playCardFlip() {
  if (!_enabled) return;
  const ctx = _getCtx();
  const buf = _getNoiseBuffer();
  if (!ctx || !buf) return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, t);
  filter.frequency.exponentialRampToValueAtTime(600, t + 0.09);
  filter.Q.value = 4;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.12);
}

/* ─── SFX 2: rare chime ──────────────────────────────────────────────────────
 * Three triangle-wave notes ascending C5 → E5 → G5 (major arpeggio) with
 * exponential decay envelopes that overlap slightly. Reads as a positive
 * "you got something good" cue without being intrusive.
 */
export function playRareChime() {
  if (!_enabled) return;
  const ctx = _getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const NOTES = [523.25, 659.25, 783.99]; // C5, E5, G5

  NOTES.forEach((freq, i) => {
    const start = t + i * 0.08;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}

/* ─── SFX 3: ultra hit ───────────────────────────────────────────────────────
 * Two-stage impact: (1) sub-bass sine sweep 220Hz → 55Hz for 150ms = thump,
 * (2) a brighter chime tail (sine 880Hz → 1320Hz pluck) for the magical
 * sparkle. Layered over a brief filtered-noise transient for the impact's
 * "crack". Distinct from the regular rare chime so the user feels the
 * jump in tier.
 */
export function playUltraHit() {
  if (!_enabled) return;
  const ctx = _getCtx();
  const buf = _getNoiseBuffer();
  if (!ctx || !buf) return;
  const t = ctx.currentTime;

  // (1) sub-bass thump
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(220, t);
  subOsc.frequency.exponentialRampToValueAtTime(55, t + 0.15);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, t);
  subGain.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  subOsc.connect(subGain).connect(ctx.destination);
  subOsc.start(t);
  subOsc.stop(t + 0.4);

  // (2) noise crack — short hi-passed transient to give the hit definition
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.20, t + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.1);

  // (3) chime tail — bright pluck arriving slightly after the impact
  const tailStart = t + 0.05;
  const tailOsc = ctx.createOscillator();
  tailOsc.type = 'sine';
  tailOsc.frequency.setValueAtTime(880, tailStart);
  tailOsc.frequency.exponentialRampToValueAtTime(1320, tailStart + 0.18);
  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(0.0001, tailStart);
  tailGain.gain.exponentialRampToValueAtTime(0.18, tailStart + 0.02);
  tailGain.gain.exponentialRampToValueAtTime(0.0001, tailStart + 0.7);
  tailOsc.connect(tailGain).connect(ctx.destination);
  tailOsc.start(tailStart);
  tailOsc.stop(tailStart + 0.75);
}

/* ─── SFX 4: pack crinkle ────────────────────────────────────────────────────
 * 600ms of bandpass-filtered noise with a stuttering, irregular gain envelope.
 * The randomness of the spike timing is what sells "foil crackling" vs flat
 * static — 10 short bursts at jittery offsets simulate finger pressure on a
 * thin metallic wrapper. Used during the idle pack-shake state.
 */
export function playPackCrinkle() {
  if (!_enabled) return;
  const ctx = _getCtx();
  const buf = _getNoiseBuffer();
  if (!ctx || !buf) return;
  const t0 = ctx.currentTime;

  // Soft noise bed (constant low rustle for the full 600ms)
  const bed = ctx.createBufferSource();
  bed.buffer = buf;
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = 'bandpass';
  bedFilter.frequency.value = 3000;
  bedFilter.Q.value = 1.2;
  const bedGain = ctx.createGain();
  bedGain.gain.setValueAtTime(0.04, t0);
  bedGain.gain.linearRampToValueAtTime(0.0001, t0 + 0.6);
  bed.connect(bedFilter).connect(bedGain).connect(ctx.destination);
  bed.start(t0);
  bed.stop(t0 + 0.62);

  // 10 random crinkle spikes — each is a 25ms hi-pass noise pop
  for (let i = 0; i < 10; i++) {
    const start = t0 + Math.random() * 0.55;
    const spike = ctx.createBufferSource();
    spike.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 2200 + Math.random() * 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.10 + Math.random() * 0.06, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.025);
    spike.connect(filt).connect(g).connect(ctx.destination);
    spike.start(start);
    spike.stop(start + 0.04);
  }
}

/* ─── SFX 5: pack tear ───────────────────────────────────────────────────────
 * Single 280ms shot. Hi-pass noise sweep 4kHz → 2kHz with sharp attack +
 * exponential decay = the rip itself. Layered with a brief sawtooth at 180Hz
 * for the "fiber pop" of foil splitting. Fires once when the user completes
 * the seam-drag gesture.
 */
export function playPackTear() {
  if (!_enabled) return;
  const ctx = _getCtx();
  const buf = _getNoiseBuffer();
  if (!ctx || !buf) return;
  const t = ctx.currentTime;

  // Rip — filtered noise sweep
  const rip = ctx.createBufferSource();
  rip.buffer = buf;
  const ripFilter = ctx.createBiquadFilter();
  ripFilter.type = 'highpass';
  ripFilter.frequency.setValueAtTime(4000, t);
  ripFilter.frequency.exponentialRampToValueAtTime(2000, t + 0.25);
  const ripGain = ctx.createGain();
  ripGain.gain.setValueAtTime(0.0001, t);
  ripGain.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
  ripGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  rip.connect(ripFilter).connect(ripGain).connect(ctx.destination);
  rip.start(t);
  rip.stop(t + 0.3);

  // Fiber pop — sub-frequency saw with fast decay
  const pop = ctx.createOscillator();
  pop.type = 'sawtooth';
  pop.frequency.setValueAtTime(180, t);
  pop.frequency.exponentialRampToValueAtTime(80, t + 0.08);
  const popGain = ctx.createGain();
  popGain.gain.setValueAtTime(0.0001, t);
  popGain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
  popGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
  pop.connect(popGain).connect(ctx.destination);
  pop.start(t);
  pop.stop(t + 0.12);
}

/* ─── SFX 6: card slide ──────────────────────────────────────────────────────
 * 400ms of bandpass-filtered noise around 800Hz with a slow attack + gentle
 * decay. Reads as a thin paper stack sliding out of the wrapper. Plays once
 * when the card stack rises after the tear.
 */
export function playCardSlide() {
  if (!_enabled) return;
  const ctx = _getCtx();
  const buf = _getNoiseBuffer();
  if (!ctx || !buf) return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.linearRampToValueAtTime(500, t + 0.4);
  filter.Q.value = 2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.45);
}


export function suspendSFXAudio() {
  const ctx = _getCtx();
  if (ctx && ctx.state === 'running') {
    ctx.suspend().catch(() => {});
  }
}

export function resumeSFXAudio() {
  const ctx = _getCtx();
  if (ctx && ctx.state === 'suspended' && isSoundEnabled()) {
    ctx.resume().catch(() => {});
  }
}
