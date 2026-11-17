// All of the game's sound is synthesised here with the Web Audio API: no audio file is loaded,
// so the game stays a set of static files with no network request. Every voice is short and
// tuned to the same key so the mix never turns to noise.

let ctx = null;
let master = null;
let enabled = true;

/** Create the audio graph on the first user gesture (browsers refuse to start it before one). */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    enabled = false;
    return;
  }
  ctx = new AudioContextClass();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

export function isAudioEnabled() {
  return enabled && ctx !== null;
}

export function toggleAudio() {
  enabled = !enabled;
  if (master) master.gain.value = enabled ? 0.5 : 0;
  return enabled;
}

/** One shaped tone: an oscillator through its own envelope, panned and scaled. */
function tone({ freq, to, type = 'sine', dur = 0.16, gain = 0.3, delay = 0, pan = 0, curve = 'exp' }) {
  if (!ctx || !enabled) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to && to !== freq) {
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
    else osc.frequency.linearRampToValueAtTime(to, start + dur);
  }
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, dur * 0.25));
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  const node = pan === 0 ? env : (() => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    env.connect(panner);
    return panner;
  })();
  osc.connect(env);
  node.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** A filtered burst of noise, for impacts and shatters. */
function noise({ dur = 0.2, gain = 0.25, freq = 900, q = 1, delay = 0, type = 'bandpass' }) {
  if (!ctx || !enabled) return;
  const start = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, start);
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  source.connect(filter);
  filter.connect(env);
  env.connect(master);
  source.start(start);
  source.stop(start + dur);
}

/** Shift a base frequency by semitones, for combo steps. */
function semi(base, steps) {
  return base * Math.pow(2, steps / 12);
}

export const sfx = {
  /** A soft rising chime when the title screen appears. */
  title() {
    tone({ freq: 392, to: 587, type: 'triangle', dur: 0.5, gain: 0.22 });
    tone({ freq: 587, to: 784, type: 'sine', dur: 0.6, gain: 0.14, delay: 0.12 });
  },
  /** The player's shield snapping up. */
  shieldUp() {
    tone({ freq: 240, to: 720, type: 'sawtooth', dur: 0.12, gain: 0.1 });
  },
  /** A shot turned back: the game's signature sound, climbing with the combo. */
  deflect(combo = 1) {
    const step = Math.min(12, (combo - 1) * 2);
    tone({ freq: semi(660, step), to: semi(1320, step), type: 'triangle', dur: 0.11, gain: 0.24 });
    noise({ dur: 0.07, gain: 0.1, freq: semi(2600, step), q: 1.4 });
  },
  /** An enemy breaking apart. */
  kill() {
    noise({ dur: 0.22, gain: 0.24, freq: 1500, q: 0.8 });
    tone({ freq: 220, to: 70, type: 'square', dur: 0.2, gain: 0.14 });
  },
  /** A shot landing on the player. */
  hurt() {
    tone({ freq: 180, to: 55, type: 'sawtooth', dur: 0.42, gain: 0.32 });
    noise({ dur: 0.3, gain: 0.2, freq: 420, q: 0.7, type: 'lowpass' });
  },
  /** A new wave starting. */
  wave() {
    tone({ freq: 330, to: 495, type: 'triangle', dur: 0.3, gain: 0.2 });
    tone({ freq: 495, to: 660, type: 'triangle', dur: 0.34, gain: 0.16, delay: 0.14 });
  },
  /** The wave's last enemy falling. */
  clear() {
    [0, 4, 7, 12].forEach((step, index) =>
      tone({ freq: semi(523, step), type: 'triangle', dur: 0.3, gain: 0.16, delay: index * 0.08 }),
    );
  },
  /** A boss arriving. */
  boss() {
    tone({ freq: 110, to: 82, type: 'sawtooth', dur: 1.1, gain: 0.26 });
    tone({ freq: 165, to: 123, type: 'square', dur: 1.0, gain: 0.12, delay: 0.06 });
    noise({ dur: 0.9, gain: 0.14, freq: 300, q: 0.6, type: 'lowpass' });
  },
  /** A boss's health stepping down. */
  bossHit() {
    tone({ freq: 300, to: 150, type: 'square', dur: 0.16, gain: 0.16 });
  },
  /** The shield running dry. */
  depleted() {
    tone({ freq: 300, to: 120, type: 'sawtooth', dur: 0.24, gain: 0.14 });
  },
  /** Game over. */
  over() {
    [0, -3, -7, -12].forEach((step, index) =>
      tone({ freq: semi(392, step), type: 'triangle', dur: 0.6, gain: 0.2, delay: index * 0.17 }),
    );
  },
  /** A menu move or confirm. */
  select() {
    tone({ freq: 880, to: 1180, type: 'square', dur: 0.07, gain: 0.1 });
  },
  /** Pausing. */
  pause() {
    tone({ freq: 520, to: 390, type: 'triangle', dur: 0.18, gain: 0.14 });
  },
};
