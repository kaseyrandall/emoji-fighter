// Per-stage fight music, composed here and played by a tiny Web Audio step
// sequencer (like the sound effects, nothing is downloaded). Each stage has
// its own theme: tempo, key, chord loop, instruments and drum kit.
//
// Patterns are strings with one character per step:
//   '.'  rest            '-'  hold the previous note one more step
//   0-9, a-e             a scale degree (a = 10 … e = 14)
// Tracks marked `abs` read degrees from the key; the others read them from the
// current bar's chord, so a bass line or arpeggio follows the progression.
// Drum patterns use 'x' (hit) and 'X' (accented hit).

import { audioOut } from './sfx';
import { useSettings } from '../store/settingsStore';

type Inst = 'bass' | 'marimba' | 'square' | 'saw' | 'accordion' | 'flute' | 'twang' | 'whistle' | 'pad' | 'bell';
type DrumKind = 'kick' | 'snare' | 'hat' | 'clap' | 'clank' | 'conga' | 'tom' | 'shaker' | 'rim';

interface Track { inst: Inst; vol: number; oct: number; abs?: boolean; bars: string[] }
interface Drum { kind: DrumKind; vol: number; bars: string[] }
interface Song {
  bpm: number;
  stepsPerBeat: number;
  root: number; // MIDI note of the key
  scale: number[];
  chords: number[]; // scale degree of each bar's chord
  swing?: number; // fraction of a step the off-steps are pushed late
  echo?: { steps: number; feedback: number; wet: number };
  tracks: Track[];
  drums: Drum[];
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10];

const SONGS: Record<string, Song> = {
  // Canopy Arena: a bouncy tropical marimba tune for the lantern-lit treetops.
  'canopy-arena': {
    bpm: 116, stepsPerBeat: 4, root: 65, scale: MAJOR, chords: [0, 5, 3, 4, 0, 5, 3, 4],
    echo: { steps: 3, feedback: 0.25, wet: 0.15 },
    tracks: [
      { inst: 'bass', vol: 0.5, oct: -2, bars: ['0..0...4..0.4...'] },
      { inst: 'marimba', vol: 0.18, oct: 0, bars: ['0.2.4.2.7.4.2.4.'] },
      {
        inst: 'marimba', vol: 0.32, oct: 1, abs: true,
        bars: [
          '4.4.5.4.2...0...', '5.5.7.5.4...2...', '3.3.5.3.2.1.0...', '1.2.4...6.4.....',
          '7.7.6.4.5.4.2...', '5.5.4.2.4.2.0...', '3.5.7.5.3.2.1...', '4.2.1.2.0.......',
        ],
      },
    ],
    drums: [
      { kind: 'kick', vol: 0.55, bars: ['x.......x.....x.'] },
      { kind: 'clap', vol: 0.18, bars: ['....x.......x...'] },
      { kind: 'conga', vol: 0.3, bars: ['..x..x....x..x.x'] },
      { kind: 'shaker', vol: 0.07, bars: ['X.x.X.x.X.x.X.x.'] },
    ],
  },

  // Pirate Cove: a rolling 6/8 sea shanty on accordion, oom-pah bass.
  'pirate-cove': {
    bpm: 104, stepsPerBeat: 3, root: 62, scale: MINOR, chords: [0, 6, 5, 4, 0, 6, 3, 4],
    tracks: [
      { inst: 'bass', vol: 0.5, oct: -2, bars: ['0..4..0..4..'] },
      { inst: 'accordion', vol: 0.1, oct: 0, bars: ['...2-....2-.'] },
      { inst: 'accordion', vol: 0.1, oct: 0, bars: ['...4-....4-.'] },
      {
        inst: 'accordion', vol: 0.2, oct: 0, abs: true,
        bars: [
          '4..4.54..2..', '3..3.43..1..', '2..2.32..0..', '1..2.34-----',
          '7..7.67..4..', '6..6.56..3..', '5..4.32..1..', '1..2.1.0----',
        ],
      },
    ],
    drums: [
      { kind: 'kick', vol: 0.5, bars: ['x.....x.....'] },
      { kind: 'clap', vol: 0.2, bars: ['...x.....x..'] },
      { kind: 'shaker', vol: 0.06, bars: ['x.xX.xx.xX.x'] },
    ],
  },

  // Jungle Temple: tribal toms and congas under a breathy pentatonic flute.
  'jungle-temple': {
    bpm: 96, stepsPerBeat: 4, root: 57, scale: MINOR_PENTA, chords: [0, 0, 2, 3, 0, 0, 4, 3],
    echo: { steps: 3, feedback: 0.35, wet: 0.25 },
    tracks: [
      { inst: 'pad', vol: 0.12, oct: -1, bars: ['0---------------'] },
      { inst: 'bass', vol: 0.45, oct: -2, bars: ['0.....0...0.3...'] },
      {
        inst: 'flute', vol: 0.22, oct: 1, abs: true,
        bars: [
          '3-------2---0---', '1---2---0-------', '5-------4---3---', '2-------3-------',
          '3---5---6---5---', '4-------3-------', '2---1---2---4---', '3---------------',
        ],
      },
    ],
    drums: [
      { kind: 'kick', vol: 0.5, bars: ['x.......x.......'] },
      { kind: 'tom', vol: 0.4, bars: ['x..x..x.x..x.x..'] },
      { kind: 'conga', vol: 0.28, bars: ['..x...x...x.x.xx'] },
      { kind: 'shaker', vol: 0.07, bars: ['..x...x...x...x.'] },
    ],
  },

  // Emoji Factory: clanking industrial electro with a pulsing square bass.
  'emoji-factory': {
    bpm: 126, stepsPerBeat: 4, root: 60, scale: MINOR, chords: [0, 0, 5, 6, 0, 0, 5, 6],
    echo: { steps: 3, feedback: 0.2, wet: 0.12 },
    tracks: [
      { inst: 'square', vol: 0.17, oct: -2, bars: ['0.07.0.0.0.07.0.'] },
      { inst: 'bell', vol: 0.16, oct: 1, bars: ['0...4...2...7...'] },
      {
        inst: 'square', vol: 0.1, oct: 0, abs: true,
        bars: [
          '0.0.3.0.5...4.3.', '0.0.3.0.2.......', '5.5.7.5.8...7.5.', '6.6.5.4.3.......',
          '0.0.3.0.5...4.3.', '0.0.3.0.2.......', '5.5.7.5.8...7.5.', '6.5.4.3.2.3.4...',
        ],
      },
    ],
    drums: [
      { kind: 'kick', vol: 0.6, bars: ['x...x...x...x...'] },
      { kind: 'snare', vol: 0.25, bars: ['....x.......x...'] },
      { kind: 'clank', vol: 0.18, bars: ['..x...x...x..x.x'] },
      { kind: 'hat', vol: 0.06, bars: ['..x...x...x...x.'] },
    ],
  },

  // Neon Subway: synthwave, with rolling arps, pads and a gated backbeat.
  'neon-subway': {
    bpm: 108, stepsPerBeat: 4, root: 57, scale: MINOR, chords: [0, 5, 2, 6, 0, 5, 2, 6],
    echo: { steps: 3, feedback: 0.35, wet: 0.22 },
    tracks: [
      { inst: 'bass', vol: 0.45, oct: -2, bars: ['0.7.0.7.0.7.0.7.'] },
      { inst: 'pad', vol: 0.07, oct: -1, bars: ['0---------------'] },
      { inst: 'pad', vol: 0.06, oct: -1, bars: ['2---------------'] },
      { inst: 'pad', vol: 0.06, oct: -1, bars: ['4---------------'] },
      { inst: 'saw', vol: 0.05, oct: 0, bars: ['0247024702470247'] },
      {
        inst: 'saw', vol: 0.12, oct: 1, abs: true,
        bars: [
          '4-------2---4---', '5-------4---2---', '2-------4---7---', '6-----------4---',
          '7---6---4---2---', '5---4---2---0---', '2---4---6---7---', '6---------------',
        ],
      },
    ],
    drums: [
      { kind: 'kick', vol: 0.6, bars: ['x...x...x...x...'] },
      { kind: 'snare', vol: 0.3, bars: ['....x.......x...'] },
      { kind: 'hat', vol: 0.05, bars: ['.x.x.x.x.x.x.x.x'] },
    ],
  },

  // Sunset Gas Station: a spaghetti-western showdown with twangy guitar,
  // a lonesome whistle and a clip-clop woodblock.
  'sunset-gas-station': {
    bpm: 90, stepsPerBeat: 4, root: 64, scale: PHRYGIAN_DOMINANT, chords: [0, 1, 0, 6, 0, 1, 0, 6],
    swing: 0.15,
    echo: { steps: 3, feedback: 0.4, wet: 0.3 },
    tracks: [
      { inst: 'bass', vol: 0.45, oct: -2, bars: ['0..0.04..0..0.4.'] },
      { inst: 'twang', vol: 0.16, oct: -1, bars: ['0...4.2.0...4.2.'] },
      {
        inst: 'whistle', vol: 0.16, oct: 1, abs: true,
        bars: [
          '7-----------4---', '5-------3-------', '4---7---9-------', '8-------6-------',
          '7-------9---a---', '8-------7---5---', '6---5---4---3---', '4---------------',
        ],
      },
    ],
    drums: [
      { kind: 'kick', vol: 0.45, bars: ['x.......x.......'] },
      { kind: 'rim', vol: 0.14, bars: ['x..x.x..x..x.x..'] },
      { kind: 'shaker', vol: 0.05, bars: ['..x...x...x...x.'] },
    ],
  },
};

// --- Instruments --------------------------------------------------------------

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}

function osc(c: AudioContext, type: OscillatorType, f: number, t: number, end: number, detune = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(end + 0.05);
  return o;
}

function vibrato(c: AudioContext, target: AudioParam, rate: number, depth: number, t: number, end: number, delay = 0) {
  const lfo = osc(c, 'sine', rate, t, end);
  const d = c.createGain();
  d.gain.setValueAtTime(0, t);
  d.gain.linearRampToValueAtTime(depth, t + delay + 0.05);
  lfo.connect(d).connect(target);
}

function lowpass(c: AudioContext, f: number, q = 0.7) {
  const flt = c.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = f;
  flt.Q.value = q;
  return flt;
}

function playNote(c: AudioContext, out: AudioNode, inst: Inst, f: number, t: number, len: number, vol: number) {
  const g = c.createGain();
  g.connect(out);
  switch (inst) {
    case 'bass': {
      const end = env(g, t, vol, 0.005, Math.max(0.02, len - 0.08), 0.1);
      const f1 = lowpass(c, 700);
      f1.connect(g);
      osc(c, 'triangle', f, t, end).connect(f1);
      const sq = c.createGain();
      sq.gain.value = 0.25;
      osc(c, 'square', f, t, end).connect(sq).connect(f1);
      break;
    }
    case 'marimba': {
      const end = env(g, t, vol, 0.003, 0, 0.45);
      osc(c, 'sine', f, t, end).connect(g);
      const h = c.createGain();
      env(h, t, 0.25, 0.002, 0, 0.08);
      h.connect(g);
      osc(c, 'sine', f * 4, t, end).connect(h);
      break;
    }
    case 'square': {
      const end = env(g, t, vol, 0.005, Math.max(0.02, len - 0.05), 0.06);
      const f1 = lowpass(c, 2600);
      f1.connect(g);
      osc(c, 'square', f, t, end).connect(f1);
      break;
    }
    case 'saw': {
      const end = env(g, t, vol, 0.01, Math.max(0.02, len - 0.1), 0.2);
      const f1 = lowpass(c, 2400, 2);
      f1.frequency.setValueAtTime(2800, t);
      f1.frequency.exponentialRampToValueAtTime(900, t + Math.max(0.1, len));
      f1.connect(g);
      osc(c, 'sawtooth', f, t, end, -7).connect(f1);
      osc(c, 'sawtooth', f, t, end, 7).connect(f1);
      break;
    }
    case 'accordion': {
      const end = env(g, t, vol, 0.03, Math.max(0.02, len - 0.06), 0.08);
      const f1 = lowpass(c, 2200);
      f1.connect(g);
      for (const d of [-8, 8]) {
        const o = osc(c, 'sawtooth', f, t, end, d);
        vibrato(c, o.frequency, 5.5, f * 0.006, t, end);
        o.connect(f1);
      }
      const low = c.createGain();
      low.gain.value = 0.4;
      osc(c, 'square', f / 2, t, end).connect(low).connect(f1);
      break;
    }
    case 'flute': {
      const end = env(g, t, vol, 0.08, Math.max(0.02, len - 0.12), 0.18);
      const o = osc(c, 'sine', f, t, end);
      vibrato(c, o.frequency, 5, f * 0.012, t, end, 0.25);
      o.connect(g);
      const tri = c.createGain();
      tri.gain.value = 0.15;
      osc(c, 'triangle', f * 2, t, end).connect(tri).connect(g);
      break;
    }
    case 'twang': {
      const end = env(g, t, vol, 0.003, 0, 0.7);
      const f1 = lowpass(c, 3200, 3);
      f1.frequency.setValueAtTime(3200, t);
      f1.frequency.exponentialRampToValueAtTime(500, t + 0.4);
      f1.connect(g);
      const o = osc(c, 'sawtooth', f * 1.02, t, end);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06); // a little string bend
      o.connect(f1);
      break;
    }
    case 'whistle': {
      const end = env(g, t, vol, 0.05, Math.max(0.02, len - 0.1), 0.2);
      const o = osc(c, 'sine', f * 0.98, t, end);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08); // scoop up into the note
      vibrato(c, o.frequency, 6, f * 0.015, t, end, 0.2);
      o.connect(g);
      break;
    }
    case 'pad': {
      const end = env(g, t, vol, 0.4, Math.max(0.02, len - 0.5), 0.6);
      const f1 = lowpass(c, 1100);
      f1.connect(g);
      for (const d of [-10, 0, 10]) osc(c, 'sawtooth', f, t, end, d).connect(f1);
      break;
    }
    case 'bell': {
      const end = env(g, t, vol, 0.002, 0, 1.1);
      osc(c, 'sine', f, t, end).connect(g);
      const h = c.createGain();
      h.gain.value = 0.35;
      osc(c, 'sine', f * 2.76, t, end).connect(h).connect(g);
      break;
    }
  }
}

function playDrum(c: AudioContext, out: AudioNode, noise: AudioBuffer, kind: DrumKind, t: number, vol: number) {
  const g = c.createGain();
  g.connect(out);
  const noiseHit = (type: BiquadFilterType, f: number, q: number, dur: number, v = vol, at = t) => {
    const src = c.createBufferSource();
    src.buffer = noise;
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    flt.Q.value = q;
    const ng = c.createGain();
    env(ng, at, v, 0.002, 0, dur);
    src.connect(flt).connect(ng).connect(out);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  };
  const thump = (from: number, to: number, dur: number, type: OscillatorType = 'sine') => {
    const end = env(g, t, vol, 0.002, 0, dur);
    const o = osc(c, type, from, t, end);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    o.connect(g);
  };
  switch (kind) {
    case 'kick': thump(150, 45, 0.3); break;
    case 'tom': thump(160, 90, 0.3); break;
    case 'conga': thump(260, 200, 0.18); break;
    case 'snare':
      noiseHit('bandpass', 1800, 0.8, 0.16);
      thump(200, 160, 0.08, 'triangle');
      break;
    case 'clap':
      for (const d of [0, 0.012, 0.024]) noiseHit('bandpass', 1300, 1.2, 0.09, vol, t + d);
      break;
    case 'hat': noiseHit('highpass', 7500, 0.7, 0.04); break;
    case 'shaker': noiseHit('highpass', 5500, 0.7, 0.07); break;
    case 'rim': thump(1700, 1600, 0.03, 'square'); break;
    case 'clank': {
      const end = env(g, t, vol, 0.001, 0, 0.14);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 4;
      bp.connect(g);
      osc(c, 'square', 540, t, end).connect(bp);
      osc(c, 'square', 813, t, end).connect(bp);
      break;
    }
  }
}

// --- Sequencer ------------------------------------------------------------------

const MUSIC_VOL = 0.22;
const LOOKAHEAD = 0.12; // seconds of notes scheduled ahead of the clock

let current: string | null = null; // stage id whose theme is playing
let song: Song | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let step = 0;
let nextTime = 0;
let busGain: GainNode | null = null;
let echoIn: GainNode | null = null;

const barLenOf = (s: Song) => s.tracks[0].bars[0].length;
const degreeOf = (ch: string) => (ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 87);
const noteFor = (s: Song, degree: number) => {
  const n = s.scale.length;
  return s.root + s.scale[((degree % n) + n) % n] + 12 * Math.floor(degree / n);
};

function scheduleStep(c: AudioContext, noise: AudioBuffer, s: Song, i: number, t: number, stepDur: number) {
  if (!busGain) return;
  const barLen = barLenOf(s);
  const bar = Math.floor(i / barLen) % s.chords.length;
  const pos = i % barLen;
  const chord = s.chords[bar];
  for (const tr of s.tracks) {
    const pattern = tr.bars[bar % tr.bars.length];
    const ch = pattern[pos];
    if (!ch || ch === '.' || ch === '-') continue;
    let len = 1;
    while (pattern[pos + len] === '-') len++;
    const degree = degreeOf(ch) + (tr.abs ? 0 : chord);
    const f = midiHz(noteFor(s, degree) + 12 * tr.oct);
    const out = echoIn && tr.inst !== 'bass' ? echoIn : busGain;
    playNote(c, out, tr.inst, f, t, len * stepDur, tr.vol);
  }
  for (const d of s.drums) {
    const ch = d.bars[bar % d.bars.length][pos];
    if (ch === 'x' || ch === 'X') playDrum(c, busGain, noise, d.kind, t, d.vol * (ch === 'X' ? 1.4 : 1));
  }
}

function tick() {
  const a = audioOut();
  if (!a || !song) return;
  const { ctx: c, noise } = a;
  const s = song;
  const barLen = barLenOf(s);
  const total = barLen * s.chords.length;
  const stepDur = 60 / s.bpm / s.stepsPerBeat;
  // After the tab was throttled, skip ahead rather than dump a burst of notes.
  if (nextTime < c.currentTime - 0.05) nextTime = c.currentTime + 0.05;
  while (nextTime < c.currentTime + LOOKAHEAD) {
    const swing = step % 2 === 1 ? (s.swing ?? 0) * stepDur : 0;
    scheduleStep(c, noise, s, step, nextTime + swing, stepDur);
    nextTime += stepDur;
    step = (step + 1) % total;
  }
}

function teardown(fade = 0.4) {
  if (timer) clearInterval(timer);
  timer = undefined;
  const a = audioOut();
  const g = busGain;
  if (a && g) {
    const t = a.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => g.disconnect(), (fade + 0.2) * 1000);
  }
  busGain = null;
  echoIn = null;
  song = null;
}

function begin(id: string) {
  const a = audioOut();
  const s = SONGS[id] ?? SONGS['canopy-arena'];
  if (!a) return;
  const { ctx: c, out } = a;
  busGain = c.createGain();
  busGain.gain.setValueAtTime(0, c.currentTime);
  busGain.gain.linearRampToValueAtTime(MUSIC_VOL, c.currentTime + 1.2);
  busGain.connect(out);
  echoIn = null;
  if (s.echo) {
    // A tempo-synced echo send (dry signal passes straight through too).
    echoIn = c.createGain();
    echoIn.connect(busGain);
    const delay = c.createDelay(2);
    delay.delayTime.value = (60 / s.bpm / s.stepsPerBeat) * s.echo.steps;
    const fb = c.createGain();
    fb.gain.value = s.echo.feedback;
    const wet = c.createGain();
    wet.gain.value = s.echo.wet;
    const damp = lowpass(c, 2500);
    echoIn.connect(delay).connect(damp).connect(fb).connect(delay);
    damp.connect(wet).connect(busGain);
  }
  song = s;
  step = 0;
  nextTime = c.currentTime + 0.1;
  tick();
  timer = setInterval(tick, 25);
}

const wanted = () => useSettings.getState().music && !document.hidden;

/** Play a stage's theme (switching over from any other). */
export function playStageMusic(stageId: string) {
  if (current === stageId && timer) return;
  current = stageId;
  teardown();
  if (wanted()) begin(stageId);
}

/** Stop the music (leaving the arena). */
export function stopMusic() {
  current = null;
  teardown();
}

// Follow the Music setting and pause while the tab is in the background.
function sync() {
  if (!current) return;
  if (wanted() && !timer) begin(current);
  else if (!wanted() && timer) teardown(0.2);
}
useSettings.subscribe(sync);
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', sync);
