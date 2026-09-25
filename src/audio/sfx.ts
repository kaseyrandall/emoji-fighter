// Synthesized sound effects (Web Audio). Every sound is built on the fly from
// oscillators and filtered noise, so none of them add download weight. Each
// fighter's special has its own recipe matching its visual effect.

import { useSettings } from '../store/settingsStore';

// Sound effects can be switched off in the pause menu's settings.
const enabled = () => useSettings.getState().sfx;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

// Browsers (iOS especially) only let audio start inside a user gesture, so
// the context is created / resumed on the first touch or key press.
const unlock = () => {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
};
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  }
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  // A gentle compressor keeps stacked effects from clipping.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(comp).connect(ctx.destination);
  const len = ctx.sampleRate;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// A quick attack / exponential decay envelope on a gain node.
function envelope(g: GainNode, t: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

interface ToneOpts {
  type?: OscillatorType;
  from: number; // start frequency, Hz
  to?: number; // end frequency (exponential glide)
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
  vibrato?: { rate: number; depth: number }; // Hz, and depth in Hz
  lowpass?: number;
}

function tone({ type = 'sine', from, to, dur, vol = 0.3, delay = 0, attack = 0.01, vibrato, lowpass }: ToneOpts) {
  if (!enabled()) return;
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  if (vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = vibrato.rate;
    depth.gain.value = vibrato.depth;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  const g = c.createGain();
  envelope(g, t, vol, attack, dur);
  let out: AudioNode = o;
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    out = o.connect(f);
  }
  out.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

interface NoiseOpts {
  filter?: BiquadFilterType;
  from: number; // filter frequency sweep start
  to?: number;
  q?: number;
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
}

function hiss({ filter = 'bandpass', from, to, q = 1, dur, vol = 0.3, delay = 0, attack = 0.01 }: NoiseOpts) {
  if (!enabled()) return;
  const c = audio();
  if (!c || !master || !noise) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = c.createGain();
  envelope(g, t, vol, attack, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// --- Jab -------------------------------------------------------------------

// The jab being thrown: a short, quick swish.
export function punchThrow() {
  hiss({ from: 900, to: 2400, q: 2.5, dur: 0.1, vol: 0.14, attack: 0.03 });
}

// The jab landing: the heavy's thud, lighter and snappier — higher, shorter
// and with a crisper slap. A blocked jab is just a quick glove tap.
export function punchImpact(blocked: boolean) {
  if (blocked) {
    tone({ from: 220, to: 130, dur: 0.07, vol: 0.35 });
    tone({ type: 'triangle', from: 1000, to: 800, dur: 0.05, vol: 0.18 });
    return;
  }
  tone({ from: 280, to: 105, dur: 0.13, vol: 0.6 });
  tone({ type: 'triangle', from: 170, to: 90, dur: 0.1, vol: 0.3 });
  hiss({ filter: 'lowpass', from: 4200, to: 700, dur: 0.07, vol: 0.5 });
}

// --- Heavy punch -----------------------------------------------------------

// The uppercut's wind-up: a rising whoosh as the glove draws back and swings.
export function heavyWindup() {
  hiss({ from: 300, to: 1400, q: 2.5, dur: 0.32, vol: 0.22, attack: 0.18 });
}

// The uppercut landing: a deep body thud with a slap on top. A blocked one
// is duller, with a hard knock off the gloves.
export function heavyImpact(blocked: boolean) {
  if (blocked) {
    tone({ from: 140, to: 70, dur: 0.16, vol: 0.5 });
    tone({ type: 'triangle', from: 820, to: 600, dur: 0.08, vol: 0.25 });
    hiss({ filter: 'lowpass', from: 1200, to: 300, dur: 0.08, vol: 0.3 });
    return;
  }
  tone({ from: 150, to: 42, dur: 0.32, vol: 0.95 });
  tone({ type: 'triangle', from: 90, to: 40, dur: 0.25, vol: 0.5 });
  hiss({ filter: 'lowpass', from: 3000, to: 250, dur: 0.14, vol: 0.6 });
}

// --- Specials, one recipe per fighter -----------------------------------------

const specials: Record<string, () => void> = {
  // Shadow Strike: a sword-fast whoosh and a blade ting.
  ninja: () => {
    hiss({ from: 2500, to: 400, q: 3, dur: 0.25, vol: 0.4 });
    hiss({ from: 3000, to: 600, q: 3, dur: 0.25, vol: 0.3, delay: 0.12 });
    tone({ from: 2600, to: 2500, dur: 0.6, vol: 0.12, delay: 0.2 });
  },
  // System Overload: buzzing, glitchy electric zaps.
  robot: () => {
    tone({ type: 'square', from: 110, to: 90, dur: 0.6, vol: 0.12, vibrato: { rate: 40, depth: 30 }, lowpass: 2400 });
    for (let i = 0; i < 6; i++) tone({ type: 'sawtooth', from: rand(800, 2200), to: rand(80, 300), dur: 0.07, vol: 0.14, delay: i * 0.08 });
  },
  // Cosmic Blast: descending sci-fi laser sweeps.
  alien: () => {
    for (let i = 0; i < 3; i++) tone({ from: 1800, to: 220, dur: 0.22, vol: 0.22, delay: i * 0.1, vibrato: { rate: 30, depth: 60 } });
    tone({ type: 'triangle', from: 300, to: 900, dur: 0.5, vol: 0.12, delay: 0.1 });
  },
  // Dragon Breath: a roaring gust of fire with crackles.
  dragon: () => {
    tone({ type: 'sawtooth', from: 110, to: 70, dur: 0.6, vol: 0.18, lowpass: 500 });
    hiss({ from: 250, to: 1400, q: 0.8, dur: 0.7, vol: 0.5, attack: 0.08 });
    for (let i = 0; i < 8; i++) hiss({ filter: 'highpass', from: 3000, dur: 0.03, vol: 0.2, delay: rand(0.1, 0.65) });
  },
  // Toxic Gas: a long, low, gassy hiss with bubbles.
  poop: () => {
    hiss({ filter: 'lowpass', from: 500, to: 250, dur: 0.9, vol: 0.45, attack: 0.1 });
    tone({ type: 'sawtooth', from: 70, to: 55, dur: 0.5, vol: 0.12, lowpass: 300, vibrato: { rate: 18, depth: 12 } });
    for (let i = 0; i < 5; i++) tone({ from: rand(180, 260), to: rand(400, 600), dur: 0.08, vol: 0.15, delay: 0.15 + i * 0.13 });
  },
  // Spectral Scream: a wavering ghostly wail.
  ghost: () => {
    tone({ from: 420, to: 760, dur: 0.45, vol: 0.2, attack: 0.1, vibrato: { rate: 6, depth: 25 } });
    tone({ from: 760, to: 300, dur: 0.6, vol: 0.2, delay: 0.4, vibrato: { rate: 5, depth: 30 } });
    hiss({ from: 1500, to: 800, q: 4, dur: 0.9, vol: 0.12, attack: 0.2 });
  },
  // Brain Buffet: wet splats pelting down.
  zombie: () => {
    for (let i = 0; i < 6; i++) {
      const d = 0.1 + i * 0.1;
      tone({ type: 'triangle', from: rand(380, 520), to: 70, dur: 0.12, vol: 0.3, delay: d });
      hiss({ filter: 'lowpass', from: 900, to: 200, dur: 0.08, vol: 0.25, delay: d + 0.03 });
    }
    tone({ type: 'sawtooth', from: 130, to: 90, dur: 0.5, vol: 0.1, lowpass: 400, vibrato: { rate: 7, depth: 10 } });
  },
  // Jurassic Chomp: a growling roar and a bone crunch.
  trex: () => {
    tone({ type: 'sawtooth', from: 150, to: 60, dur: 0.55, vol: 0.28, lowpass: 700, vibrato: { rate: 22, depth: 15 } });
    hiss({ filter: 'lowpass', from: 1200, to: 400, dur: 0.5, vol: 0.25 });
    for (let i = 0; i < 4; i++) hiss({ filter: 'highpass', from: 2000, dur: 0.04, vol: 0.35, delay: 0.45 + i * 0.05 });
  },
  // Ink Bomb: a big bloop and a splat.
  octopus: () => {
    tone({ from: 700, to: 120, dur: 0.3, vol: 0.4 });
    tone({ from: 350, to: 90, dur: 0.25, vol: 0.25, delay: 0.1 });
    hiss({ filter: 'lowpass', from: 2500, to: 300, dur: 0.3, vol: 0.4, delay: 0.12 });
  },
  // Chest Thunder: chest-drum thumps and a rolling rumble.
  gorilla: () => {
    for (let i = 0; i < 4; i++) tone({ from: 110, to: 55, dur: 0.14, vol: 0.6, delay: i * 0.1 });
    hiss({ filter: 'lowpass', from: 300, to: 90, dur: 1.0, vol: 0.5, delay: 0.35, attack: 0.05 });
    hiss({ filter: 'highpass', from: 2500, dur: 0.1, vol: 0.3, delay: 0.38 });
  },
  // Hellfire: flames erupting from below, with a devilish low tone.
  devil: () => {
    hiss({ from: 150, to: 1800, q: 1, dur: 0.6, vol: 0.5, attack: 0.15 });
    tone({ type: 'sawtooth', from: 55, to: 80, dur: 0.7, vol: 0.2, lowpass: 400 });
    for (let i = 0; i < 8; i++) hiss({ filter: 'highpass', from: 3500, dur: 0.025, vol: 0.2, delay: rand(0.1, 0.6) });
  },
  // Absolute Zero: icy shimmer and crystalline chimes.
  ice: () => {
    hiss({ filter: 'highpass', from: 5000, to: 2500, dur: 0.7, vol: 0.2, attack: 0.05 });
    [1760, 2350, 2640, 3520, 2960].forEach((f, i) => tone({ from: f, dur: 0.6, vol: 0.1, delay: i * 0.07, attack: 0.005 }));
  },
  // Roundhouse Peck: a flurry of whooshes and a squawk.
  chicken: () => {
    hiss({ from: 800, to: 2400, q: 2, dur: 0.18, vol: 0.3 });
    tone({ type: 'triangle', from: 700, to: 1300, dur: 0.1, vol: 0.25, delay: 0.1 });
    tone({ type: 'triangle', from: 900, to: 1500, dur: 0.12, vol: 0.25, delay: 0.24, vibrato: { rate: 30, depth: 80 } });
    hiss({ from: 2400, to: 700, q: 2, dur: 0.2, vol: 0.25, delay: 0.3 });
  },
  // Rainbow Ram: a bright, rising sparkly arpeggio.
  unicorn: () => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.16, delay: i * 0.06 }));
    hiss({ filter: 'highpass', from: 6000, dur: 0.5, vol: 0.08, attack: 0.1 });
  },
  // Balloon Bomb: a squeaky stretch, a POP, and a party horn.
  clown: () => {
    tone({ from: 500, to: 1400, dur: 0.25, vol: 0.18, vibrato: { rate: 25, depth: 40 } });
    hiss({ filter: 'highpass', from: 1200, dur: 0.06, vol: 0.7, delay: 0.26 });
    tone({ type: 'sawtooth', from: 440, to: 460, dur: 0.35, vol: 0.12, delay: 0.32, lowpass: 2000 });
  },
};

export function special(characterId: string | undefined) {
  const recipe = (characterId && specials[characterId]) || (() => {
    [880, 1320, 1760].forEach((f, i) => tone({ from: f, dur: 0.3, vol: 0.14, delay: i * 0.06 }));
  });
  recipe();
}
