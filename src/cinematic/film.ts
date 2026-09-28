// The film's script: timing, slow motion, and every shot as data. The 3D
// scene, the overlays and the soundtrack cue sheet are all driven from here,
// so they can't drift out of sync.

import { AttackMove } from '../types/game';
import { easeInOutCubic, easeInQuad, lerp, seg } from './timeline';

// --- Film timing ------------------------------------------------------------

export const T_VORTEX = 3.0; // the rain starts to spiral in
export const T_TITLE = 4.4; // flash + title slam
export const T_CAT = 6.0; // cut to Cattitude's entrance
export const T_INTROS = 10.0; // the roster intros
export const INTRO_LEN = 2.2;
export const T_FIGHT = T_INTROS + 5 * INTRO_LEN; // 21.0: Cattitude vs Kong Fu
export const T_FINALE = 32.5; // the line-up
export const DURATION = 38.5;
export const FPS = 30;

// Slow motion: [film start, film end, speed]. The camera and overlays run on
// film time; the fighters, effects and stage run on world time.
const SLOW: [number, number, number][] = [[T_FIGHT + 7.2, T_FIGHT + 8.7, 0.3]];

export function worldTime(t: number) {
  let w = t;
  for (const [a, b, s] of SLOW) if (t > a) w -= (Math.min(t, b) - a) * (1 - s);
  return w;
}
// Inverse of worldTime (monotonic, so bisect).
export function filmTime(w: number) {
  let lo = 0, hi = DURATION + 5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (worldTime(mid) < w) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- Shots ------------------------------------------------------------------

type Track = number | ((lw: number) => number);
export const at = (tr: Track | undefined, lw: number, fallback = 0) =>
  tr === undefined ? fallback : typeof tr === 'number' ? tr : tr(lw);

export interface Actor {
  char: string; // character id
  x: Track;
  y?: Track;
  z?: Track;
  facing: Track; // sign: +1 faces screen right
  moves?: [number, AttackMove][]; // [world-local time, move]
  hits?: [number, AttackMove, boolean?][]; // blows taken: [time, move, blocked]
  guard?: [number, number][];
  charged?: [number, number][];
  ko?: number;
  win?: number;
}

export type Fx =
  | { at: number; kind: 'land'; actor: number; big?: boolean }
  | { at: number; kind: 'hit'; actor: number; from: number; move: AttackMove; blocked?: boolean; dmg?: number }
  | { at: number; kind: 'special'; actor: number; target?: number; point?: [number, number, number] };

export interface Card { name: string; sub: string; special: string; accent: string; in: number; specialAt: number }

export interface Shot {
  key: string;
  stage: string | null; // stage id, or null for the bare line-up stage
  start: number; // film time
  end: number;
  actors: Actor[];
  fx: Fx[];
  card?: Card; // film-local times
  shakes?: [number, number][]; // [world-local time, magnitude]
}

const arc = (a: number, b: number, h: number) => (lw: number) => {
  const k = seg(lw, a, b);
  return 4 * h * k * (1 - k);
};
const move = (pts: [number, number][], ease = easeInOutCubic) => (lw: number) => {
  // Piecewise ease between [time, value] points.
  if (lw <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i];
    const [t0, v0] = pts[i - 1];
    if (lw <= t1) return lerp(v0, v1, ease(seg(lw, t0, t1)));
  }
  return pts[pts.length - 1][1];
};

// Cattitude's entrance.
export const CAT_FALL: [number, number] = [0.2, 0.75]; // world-local
export const CAT_IMPACT = 0.83; // the rig eases its height a touch behind the script
const catShot: Shot = {
  key: 'cat', stage: 'sunset-gas-station', start: T_CAT, end: T_INTROS,
  actors: [{
    char: 'cat', x: 0, facing: 1,
    y: (lw) => (lw < CAT_FALL[1] ? 9 * (1 - easeInQuad(seg(lw, CAT_FALL[0], CAT_FALL[1]))) : 0),
    moves: [[1.55, 'punch'], [1.85, 'punch'], [2.3, 'heavy'], [3.15, 'special']],
    charged: [[2.75, 3.2]],
  }],
  fx: [{ at: CAT_IMPACT, kind: 'land', actor: 0, big: true }, { at: 3.15, kind: 'special', actor: 0, point: [2.4, 1.1, 0.2] }],
  card: { name: 'CATTITUDE', sub: 'Smug, quick and always lands on its feet.', special: 'CLAW-TASTROPHE', accent: '#fb923c', in: 1.1, specialAt: 2.75 },
  shakes: [[CAT_IMPACT, 0.16]],
};

// Rapid-fire roster intros, each in its own arena.
const INTROS: { char: string; stage: string; accent: string; name: string; special: string; where: string; actor: Omit<Actor, 'char'>; specialAt: number }[] = [
  { char: 'gorilla', stage: 'jungle-temple', accent: '#9ca3af', name: 'KONG FU', special: 'CHEST THUNDER', where: 'JUNGLE TEMPLE',
    actor: { x: 0, facing: 1, moves: [[0.45, 'heavy'], [1.0, 'special']] }, specialAt: 1.0 },
  { char: 'chicken', stage: 'canopy-arena', accent: '#facc15', name: 'CLUCK NORRIS', special: 'ROUNDHOUSE PECK', where: 'CANOPY ARENA',
    actor: { x: 0, facing: 1, y: arc(0.15, 0.7, 1.3), moves: [[0.8, 'punch'], [1.05, 'special']] }, specialAt: 1.05 },
  { char: 'poop', stage: 'pirate-cove', accent: '#d97706', name: 'MCPOOP FACE', special: 'TOXIC GAS', where: 'PIRATE COVE',
    actor: { x: (lw) => Math.sin(lw * 9) * 0.18 * (1 - seg(lw, 0.6, 0.85)), facing: 1, moves: [[0.95, 'special']] }, specialAt: 0.95 },
  { char: 'dragon', stage: 'emoji-factory', accent: '#10b981', name: 'DRAGON WARRIOR', special: 'DRAGON BREATH', where: 'EMOJI FACTORY',
    actor: { x: 0, facing: 1, moves: [[0.35, 'punch'], [0.9, 'special']] }, specialAt: 0.9 },
  { char: 'ice', stage: 'neon-subway', accent: '#38bdf8', name: 'FROST BYTE', special: 'ABSOLUTE ZERO', where: 'NEON SUBWAY',
    actor: { x: 0, facing: 1, moves: [[0.3, 'punch'], [0.55, 'punch'], [1.0, 'special']] }, specialAt: 1.0 },
];
const introShots: Shot[] = INTROS.map((it, i) => ({
  key: 'intro-' + it.char, stage: it.stage, start: T_INTROS + i * INTRO_LEN, end: T_INTROS + (i + 1) * INTRO_LEN,
  actors: [{ char: it.char, ...it.actor }],
  fx: [{ at: it.specialAt, kind: 'special', actor: 0, point: [2.3, 1.1, 0.2] }],
  card: { name: it.name, sub: '@ ' + it.where, special: it.special, accent: it.accent, in: 0.08, specialAt: it.specialAt - 0.25 },
}));

// The bout: Cattitude vs Kong Fu at the gas station (world-local times).
export const FIGHT = { vs: 0, fight: 1.3, go: 1.9, catSpecial: 7.3, koHit: 7.6, ko: 7.62, win: 8.4 };
const catX = move([[1.9, -1.7], [2.2, -1.0], [3.9, -1.0], [4.55, 2.7], [5.5, 2.7], [5.75, 3.3]]);
const kongX = move([[1.9, 1.7], [2.2, 0.9], [6.2, 0.9], [6.9, 2.0], [7.62, 2.0], [7.95, 1.2]]);
export const fightX = { cat: catX, kong: kongX };
const fightShot: Shot = {
  key: 'fight', stage: 'sunset-gas-station', start: T_FIGHT, end: T_FINALE,
  actors: [
    {
      char: 'cat', x: catX, y: arc(3.9, 4.55, 2.2), facing: (lw) => (lw < 4.22 ? 1 : -1),
      moves: [[2.3, 'punch'], [2.65, 'punch'], [4.75, 'heavy'], [FIGHT.catSpecial, 'special']],
      hits: [[3.4, 'heavy', true], [5.5, 'punch']],
      guard: [[3.05, 3.65]], charged: [[6.2, FIGHT.catSpecial + 0.05]], win: FIGHT.win,
    },
    {
      char: 'gorilla', x: kongX, facing: (lw) => (lw < 4.3 ? -1 : 1),
      moves: [[3.1, 'heavy'], [5.45, 'punch']],
      hits: [[2.36, 'punch'], [2.71, 'punch'], [5.05, 'heavy'], [FIGHT.koHit, 'special']],
      ko: FIGHT.ko,
    },
  ],
  fx: [
    { at: 2.36, kind: 'hit', actor: 1, from: 0, move: 'punch', dmg: 7 },
    { at: 2.71, kind: 'hit', actor: 1, from: 0, move: 'punch', dmg: 7 },
    { at: 3.4, kind: 'hit', actor: 0, from: 1, move: 'heavy', blocked: true },
    { at: 5.05, kind: 'hit', actor: 1, from: 0, move: 'heavy', dmg: 12 },
    { at: 5.5, kind: 'hit', actor: 0, from: 1, move: 'punch', dmg: 7 },
    { at: FIGHT.catSpecial, kind: 'special', actor: 0, target: 1 },
    { at: FIGHT.koHit, kind: 'hit', actor: 1, from: 0, move: 'special', dmg: 27 },
  ],
  shakes: [[3.4, 0.08], [5.05, 0.14], [5.5, 0.08], [FIGHT.koHit, 0.3]],
};

// The line-up: every fighter drops onto tiered risers, row by row.
export const LINEUP = [
  ['cat', 'ninja', 'robot', 'alien'],
  ['dragon', 'poop', 'ghost', 'zombie'],
  ['trex', 'octopus', 'gorilla', 'devil'],
  ['ice', 'chicken', 'unicorn', 'clown'],
];
export const RISER = { dx: 1.75, dz: 2.0, dy: 1.0 };
const lineupActors: Actor[] = LINEUP.flatMap((row, r) =>
  row.map((char, c) => {
    const x = (c - 1.5) * RISER.dx;
    const landAt = 0.25 + (r * 4 + c) * 0.07;
    return {
      char, x, z: -r * RISER.dz, facing: x < 0 ? 1 : -1,
      y: (lw: number) => r * RISER.dy + (lw < landAt ? 7 * (1 - easeInQuad(seg(lw, landAt - 0.45, landAt))) : 0),
    };
  }));
const finaleShot: Shot = {
  key: 'finale', stage: null, start: T_FINALE, end: DURATION,
  actors: lineupActors,
  fx: lineupActors.map((_, i) => ({ at: 0.25 + i * 0.07 + 0.06, kind: 'land' as const, actor: i })),
};

export const SHOTS: Shot[] = [catShot, ...introShots, fightShot, finaleShot];

// World-local time of a shot at film time t.
export const localWorld = (shot: Shot, t: number) => worldTime(t) - worldTime(shot.start);

// --- Soundtrack cue sheet (film seconds) -----------------------------------

export type Cue = [number, string];
export function cueSheet(): Cue[] {
  const cues: Cue[] = [
    [0.15, 'sfx.punchThrow()'],
    [1.3, "sfx.special('gorilla')"],
    [3.0, "sfx.special('ghost')"],
    [3.55, "sfx.special('unicorn')"],
    [T_TITLE, 'sfx.heavyImpact(false)'],
    [T_TITLE, "music.playStageMusic('neon-subway')"],
    [T_TITLE + 0.35, 'sfx.punchImpact(false)'],
    [T_CAT + 0.2, 'sfx.heavyWindup()'],
    [T_FIGHT + FIGHT.fight, 'sfx.heavyImpact(false)'],
  ];
  for (const shot of SHOTS) {
    const film = (lw: number) => filmTime(worldTime(shot.start) + lw);
    const finale = shot.key === 'finale';
    shot.actors.forEach((a) => {
      for (const [lw, m] of a.moves ?? []) {
        if (m === 'punch') cues.push([film(lw), 'sfx.punchThrow()']);
        if (m === 'heavy') cues.push([film(lw), 'sfx.heavyWindup()']);
        if (m === 'special') cues.push([film(lw), `sfx.special('${a.char}')`]);
      }
    });
    for (const f of shot.fx) {
      if (f.kind === 'hit') {
        const call = f.move === 'punch' ? `sfx.punchImpact(${!!f.blocked})` : `sfx.heavyImpact(${!!f.blocked})`;
        cues.push([film(f.at), call]);
      }
      if (f.kind === 'land') {
        if (finale) cues.push([film(f.at), 'sfx.punchImpact(false)']);
        else { cues.push([film(f.at), 'sfx.heavyImpact(false)']); if (f.big) cues.push([film(f.at), "sfx.special('gorilla')"]); }
      }
    }
  }
  // Kong Fu hits the floor (inside the slow motion, so convert to film time).
  cues.push([filmTime(worldTime(T_FIGHT) + FIGHT.ko + 0.4), 'sfx.heavyImpact(false)']);
  return cues.sort((a, b) => a[0] - b[0]);
}
