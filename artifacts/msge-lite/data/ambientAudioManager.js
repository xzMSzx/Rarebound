/**
 * data/ambientAudioManager.js — Phase 10.1
 *
 * Lightweight ambient audio system using the Web Audio API. NO external
 * audio files are shipped — every sound is synthesized in-browser. This
 * honors the project's "no placeholder/mock data" rule (the audio is
 * genuinely real, just procedurally generated).
 *
 * Vendor ambience: each vendor gets a subtle drone made from 1-2
 * detuned sine/triangle oscillators with a slow LFO and gentle reverb.
 * Crossfades between vendors take 800ms.
 *
 * UI sounds: tiny 20-80ms envelope-shaped tones for clicks and shimmers.
 *
 * Volume is intentionally low. Disabled by default — opt-in via Settings.
 */

import { getSetting } from './settingsManager.js';

let ctx = null;
let masterGain = null;
let currentLayer = null;     // { stop, fadeOut } from createVendorLayer
let currentVendorId = null;
let initialized = false;
let _audioUnlocked = false;  // true after first user gesture

const VENDOR_LAYER_GAIN = 0.08;   // raised from 0.045 — audible on first enable
const UI_GAIN           = 0.085;

/** Lazily create AudioContext on first user-gesture-triggered call. */
function ensureContext() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(ctx.destination);
  return ctx;
}

/** Resume ctx if suspended (some browsers block until first gesture). */
function resumeIfNeeded() {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ });
  }
}

/**
 * Call on every meaningful user interaction. Idempotent and cheap when
 * already unlocked. Mobile browsers suspend AudioContext until a gesture;
 * this resumes it. We do NOT mark "unlocked" until the resume actually
 * succeeds, so a gesture that happens while audio is disabled can still
 * unlock later when the user enables audio + interacts again.
 */
export function unlockAudioContext() {
  if (_audioUnlocked) return;
  // Don't bother creating a context if user has audio off — but DO leave
  // the door open: next call after they enable audio will unlock.
  if (!audioEnabled()) return;
  ensureContext();
  if (!ctx) return;
  if (ctx.state === 'running') {
    _audioUnlocked = true;
    if (currentVendorId && !currentLayer) {
      const id = currentVendorId;
      currentVendorId = null;
      setVendorAmbient(id);
    }
    return;
  }
  ctx.resume().then(() => {
    _audioUnlocked = true;            // only flag unlocked after real success
    if (currentVendorId && !currentLayer) {
      const id = currentVendorId;
      currentVendorId = null;
      setVendorAmbient(id);
    }
  }).catch(() => { /* ignore — try again on next gesture */ });
}

function audioEnabled() {
  return !!getSetting('ambientAudio');
}

// ─── Vendor ambient layers ───────────────────────────────────────────────────

const VENDOR_RECIPES = {
  pokemart: {
    // Modern, soft electronic hum
    tones:    [220, 277, 330],
    type:     'sine',
    detune:   3,
    lfoRate:  0.07,
    lfoDepth: 8,
    filter:   1200,
  },
  retroVault: {
    // Warm vinyl-like archive ambience
    tones:    [110, 165],
    type:     'triangle',
    detune:   6,
    lfoRate:  0.05,
    lfoDepth: 4,
    filter:   650,
  },
  nightMarket: {
    // Low neon buzz with subtle motion
    tones:    [82, 196, 247],
    type:     'sawtooth',
    detune:   4,
    lfoRate:  0.12,
    lfoDepth: 10,
    filter:   480,
  },
  broker: {
    // Cinematic mysterious drone
    tones:    [55, 82.5, 110],
    type:     'sine',
    detune:   2,
    lfoRate:  0.03,
    lfoDepth: 5,
    filter:   400,
  },
};

function createVendorLayer(vendorId) {
  const recipe = VENDOR_RECIPES[vendorId];
  if (!recipe || !ctx) return null;

  const layerGain = ctx.createGain();
  layerGain.gain.value = 0;     // fade in below
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = recipe.filter;
  filter.Q.value = 0.5;
  filter.connect(layerGain);
  layerGain.connect(masterGain);

  const oscs = [];
  recipe.tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = recipe.type;
    osc.frequency.value = freq;
    osc.detune.value = (i % 2 === 0 ? 1 : -1) * recipe.detune;
    osc.connect(filter);
    osc.start();
    oscs.push(osc);
  });

  // LFO modulating filter cutoff for slow movement
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = recipe.lfoRate;
  lfoGain.gain.value  = recipe.lfoDepth;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  // Fade in
  const now = ctx.currentTime;
  layerGain.gain.setValueAtTime(0, now);
  layerGain.gain.linearRampToValueAtTime(VENDOR_LAYER_GAIN, now + 0.8);

  return {
    stop: () => {
      try { oscs.forEach(o => o.stop()); lfo.stop(); } catch {}
    },
    fadeOut: () => new Promise(resolve => {
      const t = ctx.currentTime;
      layerGain.gain.cancelScheduledValues(t);
      layerGain.gain.setValueAtTime(layerGain.gain.value, t);
      layerGain.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => {
        try { oscs.forEach(o => o.stop()); lfo.stop(); } catch {}
        try { filter.disconnect(); layerGain.disconnect(); } catch {}
        resolve();
      }, 850);
    }),
  };
}

/**
 * Set the active vendor ambience. Crossfades from any current layer.
 * No-op if audio is disabled. Safe to call repeatedly with same id.
 */
export function setVendorAmbient(vendorId) {
  initialized = true;
  if (!audioEnabled()) { stopVendorAmbient(); return; }
  ensureContext();
  if (!ctx) return;
  resumeIfNeeded();

  if (currentVendorId === vendorId && currentLayer) return;
  currentVendorId = vendorId;

  const prev = currentLayer;
  currentLayer = createVendorLayer(vendorId);
  if (prev) prev.fadeOut();
}

export function stopVendorAmbient() {
  if (currentLayer) {
    currentLayer.fadeOut();
    currentLayer = null;
  }
  currentVendorId = null;
}

/**
 * Called when the user toggles ambient audio in Settings.
 * If turning off, kill the active layer immediately. If turning on
 * and a vendor was previously active, restart it.
 *
 * The toggle tap itself is a user gesture, so we attempt AudioContext
 * unlock here — this is the earliest reliable moment to resume the
 * context after the user opts in, without requiring a second tap.
 */
/** Returns the AudioContext state string for the diagnostics overlay. */
export function getAudioContextState() {
  return ctx?.state ?? 'none';
}

export function refreshAmbientFromSettings() {
  if (!initialized) return;
  if (audioEnabled()) {
    // Attempt unlock immediately — the settings toggle tap IS a gesture.
    // unlockAudioContext is a no-op if already unlocked.
    unlockAudioContext();
    if (currentVendorId) {
      const id = currentVendorId;
      currentVendorId = null;       // force re-init
      setVendorAmbient(id);
    }
  } else {
    stopVendorAmbient();
  }
}

// ─── UI sound effects ────────────────────────────────────────────────────────

/** Generic enveloped tone — kept private so callers go through named sfx fns. */
function playTone({ freq = 440, type = 'sine', durMs = 80, gain = UI_GAIN, slideTo = null }) {
  if (!audioEnabled()) return;
  ensureContext();
  if (!ctx) return;
  resumeIfNeeded();

  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo) {
    osc.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + durMs / 1000);
  }
  osc.connect(g); g.connect(masterGain);

  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
  osc.start(t);
  osc.stop(t + durMs / 1000 + 0.02);
}

function playChord(freqs, opts = {}) {
  freqs.forEach((f, i) => {
    setTimeout(() => playTone({ freq: f, ...opts }), i * 40);
  });
}

export const sfx = {
  click:        () => playTone({ freq: 720, type: 'sine',     durMs: 50,  gain: 0.05 }),
  purchase:     () => playTone({ freq: 540, type: 'triangle', durMs: 110, gain: 0.07 }),
  rareShimmer:  () => playChord([880, 1175, 1568, 2093], { type: 'sine', durMs: 320, gain: 0.05 }),
  pageFlip:     () => playTone({ freq: 320, type: 'triangle', durMs: 90,  gain: 0.05, slideTo: 220 }),
  wishlistTick: () => playTone({ freq: 1320, type: 'square', durMs: 35,  gain: 0.04 }),
  graphSweep:   () => playTone({ freq: 220, type: 'sine',    durMs: 380, gain: 0.05, slideTo: 880 }),
  boxSeal:      () => playChord([196, 247, 330], { type: 'triangle', durMs: 240, gain: 0.06 }),
};
