import React from 'react';
import { flushSync } from 'react-dom';
import * as THREE from 'three';
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber';
import { EmojiBody } from '../three/EmojiBody';
import { Fighter } from '../three/Fighter';
import { Stage3D } from '../three/Stage3D';
import { Vfx, VfxApi } from '../three/Vfx';
import { FighterInput, defaultFighterInput } from '../three/fighterInput';
import { specialStyleOf } from '../three/specialStyles';
import { stages } from '../data/stages';
import { characters } from '../data/characters';
import { accentOf } from '../data/accents';
import {
  crossed, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, now, rng, seg, useCine,
} from './timeline';
import {
  Actor, CAT_FALL, CAT_IMPACT, DURATION, FIGHT, FPS, INTRO_LEN, LINEUP, RISER, SHOTS, Shot, T_CAT, T_FIGHT, T_FINALE,
  T_INTROS, T_TITLE, T_VORTEX, at, fightX, localWorld, worldTime,
} from './film';

// Emoji Fighter: the introduction. A scripted film built from the game's own
// fighter rigs, stages and effects, rendered frame by frame (see film.ts for
// the script and cinematic.html for how to preview it).

const FORMATS = { vertical: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] } as const;
type Format = keyof typeof FORMATS;

const params = new URLSearchParams(location.search);
const format = (params.get('format') as Format) in FORMATS ? (params.get('format') as Format) : 'vertical';
const [W, H] = FORMATS[format];
const PORTRAIT = W < H;

const charOf = (id: string) => characters.find((c) => c.id === id)!;
const stageOf = (id: string) => stages.find((s) => s.id === id)!;
const shotAt = (t: number) => SHOTS.find((s) => t >= s.start && t < s.end);

// --- Cold open: one emoji, then a downpour that spirals into a vortex ------

const RAIN_EMOJI = ['😼', '🥷', '🤖', '👽', '🐲', '💩', '👻', '🧟', '🦖', '🐙', '🦍', '😈', '🥶', '🐔', '🦄', '🤡', '💥', '🔥', '⚡', '👊'];
const VORTEX_CENTER = new THREE.Vector3(0, 1.5, -1);

interface Drop { emoji: string; start: number; x: number; z: number; speed: number; spin: number; a0: number; r0: number; scale: number }
const DROPS: Drop[] = (() => {
  const r = rng(7);
  const list: Drop[] = [
    // The lone first emoji, falling slowly past the camera's eyeline.
    { emoji: '👊', start: 0, x: 0, z: 3.2, speed: 2.6, spin: 1.6, a0: 0, r0: 1.4, scale: 1.25 },
  ];
  for (let i = 0; i < 70; i++) {
    list.push({
      emoji: RAIN_EMOJI[i % RAIN_EMOJI.length],
      start: 1.25 + r() * 1.5,
      x: (r() - 0.5) * (PORTRAIT ? 7.5 : 13),
      z: -6 + r() * 7,
      speed: 4 + r() * 5,
      spin: (r() - 0.5) * 5,
      a0: r() * Math.PI * 2,
      r0: 1.6 + r() * 2.4,
      scale: 0.55 + r() * 0.75,
    });
  }
  return list;
})();

function RainDrop({ d }: { d: Drop }) {
  const ref = React.useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = now();
    const fallT = t - d.start;
    if (fallT < 0 || t > T_TITLE + 0.05) { g.visible = false; return; }
    g.visible = true;
    // Falling (wrapping back to the top so the downpour never thins out).
    const top = d.start === 0 ? 5.2 : 8.5;
    const fy = top - ((d.speed * fallT) % 15);
    const fall = new THREE.Vector3(d.x, fy, d.z);
    // Spiral: blend onto a tightening, speeding-up whirl around the centre.
    const pull = easeInOutCubic(seg(t, T_VORTEX, T_VORTEX + 0.8));
    const squeeze = easeInCubic(seg(t, T_VORTEX, T_TITLE));
    const ang = d.a0 + (t - T_VORTEX) * (3 + 7 * squeeze);
    const rad = d.r0 * (1 - squeeze);
    const spiral = new THREE.Vector3(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.9, Math.sin(ang * 0.5) * rad * 0.4).add(VORTEX_CENTER);
    g.position.copy(fall.lerp(spiral, pull));
    g.rotation.set(Math.sin(t * 1.3 + d.a0) * 0.45, Math.sin(t * 0.9 + d.a0) * 0.7, t * d.spin);
    g.scale.setScalar(d.scale * (1 - 0.75 * squeeze));
  });
  return (
    <group ref={ref} visible={false}>
      <EmojiBody emoji={d.emoji} size={1.3} depth={0.22} layers={4} />
    </group>
  );
}

function ColdOpen() {
  const ref = React.useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.visible = now() < T_CAT; });
  return (
    <group ref={ref}>
      <hemisphereLight args={['#fff4dc', '#1a1026', 1.2]} />
      <directionalLight position={[3, 6, 8]} intensity={1.4} />
      <pointLight position={[0, 1.5, 1]} intensity={30} distance={12} color="#facc15" />
      {DROPS.map((d, i) => <RainDrop key={i} d={d} />)}
    </group>
  );
}

// --- Scripted shots -------------------------------------------------------------

const chest = (inp: FighterInput) => new THREE.Vector3(inp.x, inp.y + 1.1, 0.2);
const within = (ranges: [number, number][] | undefined, lw: number) => !!ranges?.some(([a, b]) => lw >= a && lw < b);

function actorInput(a: Actor, lw: number, out: FighterInput, dt: number) {
  const x = at(a.x, lw);
  out.vel = dt > 0 ? (x - out.x) / dt : 0;
  out.x = x;
  out.y = at(a.y, lw);
  out.facing = at(a.facing, lw) < 0 ? -1 : 1;
  const done = (a.moves ?? []).filter(([t]) => lw >= t);
  out.attackSeq = done.length;
  out.attackMove = done.length ? done[done.length - 1][1] : null;
  const taken = (a.hits ?? []).filter(([t]) => lw >= t);
  out.hitSeq = taken.length;
  out.hitMove = taken.length ? taken[taken.length - 1][1] : null;
  out.hitBlocked = taken.length ? !!taken[taken.length - 1][2] : false;
  out.guard = within(a.guard, lw);
  out.charged = within(a.charged, lw);
  out.pose = a.ko !== undefined && lw >= a.ko ? 'ko' : a.win !== undefined && lw >= a.win ? 'win' : 'fight';
}

function ShotView({ shot }: { shot: Shot }) {
  const ref = React.useRef<THREE.Group>(null);
  const vfx = React.useRef<VfxApi>(null);
  const inputs = React.useRef(shot.actors.map((a) => defaultFighterInput(at(a.x, 0), 1)));
  const prev = React.useRef(-1);

  useFrame(() => {
    const t = now();
    const live = t >= shot.start && t < shot.end;
    if (ref.current) ref.current.visible = live;
    if (!live) return;
    const lw = localWorld(shot, t);
    const p = prev.current;
    const dt = p < 0 ? 0 : lw - p;
    shot.actors.forEach((a, i) => actorInput(a, lw, inputs.current[i], dt));
    const api = vfx.current;
    if (api) {
      for (const f of shot.fx) {
        if (!crossed(p, lw, f.at)) continue;
        const me = inputs.current[f.actor];
        if (f.kind === 'land') {
          const v = new THREE.Vector3(me.x, me.y + 0.05, at(shot.actors[f.actor].z, lw));
          const accent = accentOf(shot.actors[f.actor].char);
          if (f.big) {
            api.ring(v, accent, 2.6, 0.55, true);
            api.ring(v, '#fde68a', 1.6, 0.4, true);
            api.burst(v.setY(me.y + 0.3), '#d6b98c', 46, 5.5);
          } else {
            api.ring(v, accent, 1.2, 0.35, true);
            api.burst(v.setY(me.y + 0.3), accent, 10, 3);
          }
        } else if (f.kind === 'special') {
          const style = specialStyleOf(shot.actors[f.actor].char);
          const from = chest(me);
          const target = f.target !== undefined ? chest(inputs.current[f.target]) : new THREE.Vector3(...(f.point ?? [2.3, 1.1, 0.2]));
          api.special(style, from, me.facing, target);
        } else {
          const attacker = inputs.current[f.from];
          const side = Math.sign(attacker.x - me.x) || 1;
          const v = new THREE.Vector3(me.x + side * 0.55, me.y + (f.move === 'heavy' ? 1.45 : 1.15), 0.4);
          if (f.blocked) {
            api.burst(v, '#7dd3fc', 16, 4.5);
            api.ring(v, '#bae6fd', 0.8, 0.22);
            api.number(v.clone().setY(me.y + 2.1), 'BLOCK', '#7dd3fc');
          } else {
            // The special's own effect carries its hit; quick blows get sparks.
            // No damage numbers: in the slow motion they linger and pile up.
            if (f.move === 'special') api.burst(v, '#ffffff', 18, 4);
            else {
              const color = f.move === 'heavy' ? '#ff8a3d' : '#ffd84d';
              api.burst(v, color, f.move === 'heavy' ? 28 : 18, 6);
              api.burst(v, '#ffffff', 8, 4);
              if (f.move === 'heavy') api.ring(v, color, 0.9, 0.25);
            }
          }
        }
      }
    }
    prev.current = lw;
  });

  return (
    <group ref={ref} visible={false}>
      {shot.stage ? <Stage3D stage={stageOf(shot.stage)} /> : <LineupStage />}
      {shot.actors.map((a, i) => (
        <group key={i} position={[0, 0, at(a.z, 0)]}>
          <Fighter emoji={charOf(a.char).emoji} auraColor={specialStyleOf(a.char).color} read={() => inputs.current[i]} />
        </group>
      ))}
      <Vfx ref={vfx} />
    </group>
  );
}

// The finale's bare stage: dark tiered risers under coloured rim lights.
function LineupStage() {
  return (
    <group>
      <hemisphereLight args={['#fff4dc', '#120c1c', 1.1]} />
      <directionalLight position={[3, 8, 9]} intensity={1.5} />
      <directionalLight position={[-6, 5, -8]} intensity={1.6} color="#a855f7" />
      <directionalLight position={[6, 5, -8]} intensity={1.6} color="#fb923c" />
      {LINEUP.map((_, r) => (
        <group key={r} position={[0, r * RISER.dy - 0.25, -r * RISER.dz]}>
          <mesh>
            <boxGeometry args={[4 * RISER.dx + 0.8, 0.5, RISER.dz]} />
            <meshStandardMaterial color="#17131f" roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.26, RISER.dz / 2 - 0.02]}>
            <boxGeometry args={[4 * RISER.dx + 0.8, 0.03, 0.04]} />
            <meshBasicMaterial color="#facc15" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --- Camera ---------------------------------------------------------------------

const shakeAt = (t: number, from: number, dur: number, mag: number) => {
  if (t < from) return 0;
  const k = 1 - seg(t, from, from + dur);
  return k <= 0 ? 0 : Math.sin(t * 91) * mag * k;
};

type V3 = [number, number, number];
type Cam = { pos: V3; look: V3 };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: [lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k)],
  look: [lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k)],
});

function coldOpenCam(t: number): Cam {
  const back = easeInOutCubic(seg(t, 1.1, 2.4));
  const push = easeInOutCubic(seg(t, T_VORTEX, T_TITLE));
  const loneY = 5.2 - DROPS[0].speed * Math.min(t, 1.3);
  const z = lerp(lerp(PORTRAIT ? 8 : 7, PORTRAIT ? 13 : 11, back), PORTRAIT ? 10 : 8.5, push);
  return { pos: [shakeAt(t, 1.25, 0.6, 0.12), lerp(loneY + 0.4, 1.5, back), z], look: [0, lerp(loneY, 1.5, back), 0] };
}

function catCam(lt: number): Cam {
  // Cattitude drops in from the top of frame, then the camera settles wide
  // enough for the combo and special and pushes in slowly. In portrait the
  // look point sits low so Cattitude rides above the name card.
  const settle = easeInOutCubic(seg(lt, CAT_FALL[1] - 0.05, CAT_FALL[1] + 0.5));
  const push = easeInOutCubic(seg(lt, CAT_FALL[1] + 0.3, T_INTROS - T_CAT));
  const dist = PORTRAIT ? lerp(9.4, 8.2, push) : lerp(7.5, 6.4, push);
  const sx = shakeAt(lt, CAT_IMPACT, 0.45, 0.16);
  return {
    pos: [lerp(0.2, 0.7, push) + sx, lerp(0.9, 1.3, settle) + sx * 0.6, dist],
    look: [PORTRAIT ? 0.6 : 0.8, lerp(PORTRAIT ? 1.2 : 1.6, PORTRAIT ? 0.55 : 1.0, settle), 0],
  };
}

function introCam(lt: number, i: number): Cam {
  // A quick orbiting push-in, alternating sides shot to shot.
  const k = easeOutCubic(seg(lt, 0, INTRO_LEN));
  const side = i % 2 ? -1 : 1;
  const ang = side * lerp(0.55, 0.12, k);
  const dist = PORTRAIT ? lerp(9.8, 8.4, k) : lerp(7.6, 6.6, k);
  const cx = PORTRAIT ? 0.6 : 0.8;
  return { pos: [cx + Math.sin(ang) * dist, lerp(1.6, 1.25, k), Math.cos(ang) * dist], look: [cx, PORTRAIT ? 0.55 : 1.0, 0] };
}

// Film-local window of the fight's slow motion (see SLOW in film.ts).
const SLOW_A = 7.2, SLOW_B = 8.7;

function fightCam(t: number, shot: Shot): Cam {
  const lt = t - shot.start;
  const lw = localWorld(shot, t);
  const cx = fightX.cat(lw), kx = fightX.kong(lw);
  const mid = (cx + kx) / 2;
  const sep = Math.abs(cx - kx);
  let shake = 0;
  for (const [w, m] of shot.shakes ?? []) shake += shakeAt(lw, w, 0.35, m);
  if (lw < FIGHT.go) {
    // VS: a slow orbit in front of both fighters.
    const a = lerp(-0.45, -0.1, easeOutCubic(seg(lt, 0, FIGHT.go)));
    const d = PORTRAIT ? 13 : 9.5;
    return { pos: [Math.sin(a) * d, 1.8, Math.cos(a) * d], look: [0, PORTRAIT ? 0.9 : 1.2, 0] };
  }
  const tracking: Cam = {
    pos: [mid + shake, 1.6 + shake * 0.5, (PORTRAIT ? 8.6 : 7.4) + sep * (PORTRAIT ? 0.55 : 0.4)],
    look: [mid, PORTRAIT ? 1.05 : 1.1, 0],
  };
  // Slow motion: swing in close around the special, then rise over the K.O.
  const swing = easeInOutCubic(seg(lt, SLOW_A - 0.3, SLOW_B));
  const a = lerp(0, 0.75, swing);
  const d = lerp(PORTRAIT ? 10.5 : 8.5, PORTRAIT ? 9 : 7, swing);
  const orbit: Cam = { pos: [mid + Math.sin(a) * d + shake, lerp(1.6, 2.0, swing), Math.cos(a) * d], look: [mid, 1.05, 0] };
  const ko: Cam = { pos: [kx + 0.8, 3.4, PORTRAIT ? 7.8 : 6.4], look: [kx, 0.4, 0] };
  const intoOrbit = mixCam(tracking, orbit, easeInOutCubic(seg(lt, SLOW_A - 0.3, SLOW_A)));
  return mixCam(intoOrbit, ko, easeInOutCubic(seg(lt, SLOW_B, SLOW_B + 1.2)));
}

function finaleCam(lt: number): Cam {
  // Start on the front row, then pull back and up to reveal the whole roster.
  const k = easeInOutCubic(seg(lt, 0.2, 3.2));
  const centerZ = -1.5 * RISER.dz, centerY = 1.5 * RISER.dy + 0.8;
  const d = PORTRAIT ? lerp(9, 17.5, k) : lerp(7, 13, k);
  // The look point ends above the risers' centre so the roster sits clear of
  // the title at the top of frame.
  return { pos: [lerp(-1.2, 0, k), lerp(1.6, centerY + 2.2, k), centerZ + d], look: [0, lerp(1.0, centerY + 0.9, k), lerp(0, centerZ, k)] };
}

function Director() {
  const { camera } = useThree();
  const look = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const t = now();
    const cam = camera as THREE.PerspectiveCamera;
    const shot = shotAt(t);
    let c: Cam;
    if (!shot) c = coldOpenCam(t);
    else if (shot.key === 'cat') c = catCam(t - shot.start);
    else if (shot.key.startsWith('intro-')) c = introCam(t - shot.start, SHOTS.indexOf(shot) - 1);
    else if (shot.key === 'fight') c = fightCam(t, shot);
    else c = finaleCam(t - shot.start);
    cam.fov = 40;
    cam.position.set(...c.pos);
    cam.updateProjectionMatrix();
    cam.lookAt(look.set(...c.look));
  });
  return null;
}

// --- DOM overlays ---------------------------------------------------------------

const PX = W / 1080; // design unit: 1px at 1080 wide
const OUTLINE = (s: number) => `0 ${6 * s}px 0 #000, 0 ${-3 * s}px 0 #000, ${4 * s}px 0 0 #000, ${-4 * s}px 0 0 #000`;

function Wordmark({ size, badge = 1 }: { size: number; badge?: number }) {
  return (
    <div style={{ fontSize: size * PX, lineHeight: 1.25, letterSpacing: 8 * PX, textAlign: 'center',
      textShadow: `0 ${10 * PX}px 0 #000, 0 0 ${60 * PX}px rgba(250,204,21,0.45)` }}>
      EMOJI<br />
      <span style={{ position: 'relative' }}>
        FIGHTER
        <span style={{ position: 'absolute', left: '100%', marginLeft: 12 * PX, top: -0.25 * size * PX, fontSize: size * 0.34 * PX, lineHeight: 1,
          background: '#facc15', color: '#000', padding: `${12 * PX}px ${13 * PX}px ${10 * PX}px`, borderRadius: 12 * PX,
          transform: `rotate(-10deg) scale(${badge})`, textShadow: 'none', boxShadow: `0 ${6 * PX}px 0 #a16207`, letterSpacing: 2 * PX }}>3D</span>
      </span>
    </div>
  );
}

function Title({ t }: { t: number }) {
  // Slams in, the badge pops, the tagline fades up, then it blasts off.
  const tin = seg(t, T_TITLE, T_TITLE + 0.28);
  const tout = seg(t, T_CAT - 0.35, T_CAT);
  const scale = lerp(2.4, 1, easeOutBack(tin)) * (1 + 0.6 * easeInCubic(tout));
  const badge = easeOutBack(seg(t, T_TITLE + 0.35, T_TITLE + 0.6));
  const tag = easeOutCubic(seg(t, T_TITLE + 0.55, T_TITLE + 0.9));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: '42%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      transform: `translate(${shakeAt(t, T_TITLE, 0.3, 10 * PX)}px, -50%) scale(${scale})`, opacity: 1 - tout }}>
      <Wordmark size={118} badge={badge} />
      <div style={{ marginTop: 50 * PX, fontSize: 30 * PX, letterSpacing: 5 * PX, color: '#e4e4e7', opacity: tag,
        transform: `translateY(${(1 - tag) * 20 * PX}px)`, textShadow: `0 ${4 * PX}px 0 #000` }}>16 FIGHTERS · 6 ARENAS</div>
    </div>
  );
}

function NameCard({ shot, t }: { shot: Shot; t: number }) {
  const c = shot.card!;
  const lt = t - shot.start;
  const cardIn = easeOutCubic(seg(lt, c.in, c.in + 0.35));
  const specialIn = easeOutBack(seg(lt, c.specialAt, c.specialAt + 0.3));
  const big = shot.key === 'cat';
  return (
    <div style={{ position: 'absolute', left: 0, bottom: H * 0.13, transform: `translateX(${(cardIn - 1) * W}px)` }}>
      <div style={{ background: `linear-gradient(90deg, ${c.accent} 0%, ${c.accent}cc 70%, transparent 100%)`, padding: `${26 * PX}px ${80 * PX}px ${26 * PX}px ${56 * PX}px` }}>
        <div style={{ fontSize: (big ? 76 : 64) * PX, letterSpacing: 6 * PX, textShadow: `0 ${8 * PX}px 0 rgba(0,0,0,0.55)` }}>{c.name}</div>
      </div>
      <div style={{ marginTop: 22 * PX, marginLeft: 56 * PX, fontSize: 26 * PX, lineHeight: 1.6, letterSpacing: 2 * PX, color: '#f4f4f5',
        textShadow: `0 ${4 * PX}px 0 #000`, maxWidth: W * 0.8 }}>{c.sub}</div>
      <div style={{ marginTop: 26 * PX, marginLeft: 56 * PX, display: 'inline-block', fontSize: 24 * PX, letterSpacing: 3 * PX,
        background: 'rgba(0,0,0,0.6)', border: `${3 * PX}px solid ${c.accent}`, color: '#fde68a', padding: `${14 * PX}px ${18 * PX}px`,
        borderRadius: 12 * PX, transform: `scale(${specialIn})`, transformOrigin: 'left center' }}>
        ✦ SPECIAL · {c.special}
      </div>
    </div>
  );
}

// A word that slams onto the screen and holds.
function Slam({ t, from, until, text, color, size, top = '30%' }: { t: number; from: number; until: number; text: string; color: string; size: number; top?: string }) {
  if (t < from || t >= until) return null;
  const k = easeOutBack(seg(t, from, from + 0.22));
  const out = seg(t, until - 0.2, until);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, textAlign: 'center', fontSize: size * PX, color, letterSpacing: 6 * PX,
      textShadow: OUTLINE((PX * size) / 60), transform: `scale(${lerp(2.2, 1, k) * (1 + out * 0.4)})`, opacity: 1 - out, whiteSpace: 'nowrap' }}>{text}</div>
  );
}

// Film time of a fight moment given in world-local time (inside or after the
// slow motion).
const fightFilm = (w: number) => (w <= SLOW_A ? T_FIGHT + w : w <= SLOW_A + (SLOW_B - SLOW_A) * 0.3
  ? T_FIGHT + SLOW_A + (w - SLOW_A) / 0.3
  : T_FIGHT + SLOW_B + (w - SLOW_A - (SLOW_B - SLOW_A) * 0.3));

function FightOverlays({ t }: { t: number }) {
  const lt = t - T_FIGHT;
  const vsIn = easeOutCubic(seg(lt, 0.05, 0.4));
  const vsOut = seg(lt, FIGHT.fight - 0.15, FIGHT.fight);
  const name = (id: string, side: 1 | -1) => (
    <div style={{ transform: `translateX(${(1 - vsIn) * side * -W}px)`, textAlign: side > 0 ? 'left' : 'right', padding: `0 ${56 * PX}px` }}>
      <div style={{ fontSize: 120 * PX }}>{charOf(id).emoji}</div>
      <div style={{ marginTop: 18 * PX, fontSize: 52 * PX, letterSpacing: 4 * PX, color: accentOf(id), textShadow: OUTLINE(PX) }}>{charOf(id).name.toUpperCase()}</div>
    </div>
  );
  const special = fightFilm(FIGHT.catSpecial);
  const ko = fightFilm(FIGHT.ko + 0.25);
  return (
    <>
      {lt < FIGHT.fight && (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - vsOut, background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 30%, transparent 70%, rgba(0,0,0,0.55))' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '8%' }}>{name('cat', 1)}</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '9%' }}>{name('gorilla', -1)}</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', fontSize: 150 * PX, color: '#ef4444',
            transform: `translateY(-50%) scale(${lerp(2.5, 1, easeOutBack(seg(lt, 0.3, 0.55)))})`, textShadow: OUTLINE(PX * 2.5) }}>VS</div>
        </div>
      )}
      <Slam t={t} from={T_FIGHT + FIGHT.fight} until={T_FIGHT + FIGHT.go + 0.25} text="FIGHT!" color="#ef4444" size={120} top="22%" />
      <Slam t={t} from={special} until={special + 1.5} text="CLAW-TASTROPHE" color="#fb923c" size={62} top="16%" />
      <Slam t={t} from={ko} until={T_FINALE} text="K.O." color="#ef4444" size={170} top="20%" />
    </>
  );
}

function FinaleOverlays({ t }: { t: number }) {
  const lt = t - T_FINALE;
  const title = easeOutBack(seg(lt, 1.6, 1.95));
  const cta = easeOutCubic(seg(lt, 2.4, 2.8));
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: PORTRAIT ? '7%' : '5%', display: 'flex', justifyContent: 'center',
        transform: `scale(${title})`, opacity: seg(lt, 1.6, 1.7) }}>
        <Wordmark size={PORTRAIT ? 104 : 84} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: PORTRAIT ? '9%' : '6%', textAlign: 'center', opacity: cta,
        transform: `translateY(${(1 - cta) * 30 * PX}px)` }}>
        <div style={{ display: 'inline-block', fontSize: 40 * PX, letterSpacing: 4 * PX, background: '#facc15', color: '#000',
          padding: `${26 * PX}px ${34 * PX}px ${22 * PX}px`, borderRadius: 16 * PX, boxShadow: `0 ${8 * PX}px 0 #a16207` }}>PLAY FREE</div>
        <div style={{ marginTop: 34 * PX, fontSize: 26 * PX, letterSpacing: 3 * PX, color: '#e4e4e7', textShadow: `0 ${4 * PX}px 0 #000` }}>IN YOUR BROWSER · MOBILE &amp; DESKTOP</div>
      </div>
    </>
  );
}

function Overlays() {
  const t = useCine((s) => s.t);
  const shot = shotAt(t);
  // White flash into the title; a quick colour wipe on each cut after it.
  const titleFlash = t < T_TITLE - 0.06 ? 0 : t < T_TITLE ? seg(t, T_TITLE - 0.06, T_TITLE) : 1 - easeOutCubic(seg(t, T_TITLE, T_TITLE + 0.55));
  const cut = shot && shot.start > T_CAT ? 1 - seg(t, shot.start, shot.start + 0.16) : 0;
  const cutColor = shot?.card?.accent ?? (shot?.key === 'finale' ? '#000000' : '#ffffff');
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: '"Press Start 2P", monospace', color: '#fff' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
      {t >= T_TITLE && t < T_CAT && <Title t={t} />}
      {shot?.card && <NameCard shot={shot} t={t} />}
      {shot?.key === 'fight' && <FightOverlays t={t} />}
      {shot?.key === 'finale' && <FinaleOverlays t={t} />}
      <div style={{ position: 'absolute', inset: 0, background: cutColor, opacity: cut * 0.85 }} />
      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: titleFlash }} />
    </div>
  );
}

// --- Clock driver ---------------------------------------------------------------

function renderAt(t: number) {
  const { t: prev, take } = useCine.getState();
  flushSync(() => useCine.setState(t < prev ? { t, take: take + 1 } : { t }));
  // The 3D world runs on world time (slowed during the slow motion).
  advance(worldTime(t));
}

// The 3D scene, remounted fresh for each take.
function Scene() {
  const take = useCine((s) => s.take);
  return (
    <group key={take}>
      <Director />
      <ColdOpen />
      {SHOTS.map((s) => <ShotView key={s.key} shot={s} />)}
    </group>
  );
}

declare global {
  interface Window { __cine?: { duration: number; fps: number; format: Format; renderAt: (t: number) => void } }
}

export default function Cinematic() {
  React.useEffect(() => {
    window.__cine = { duration: DURATION, fps: FPS, format, renderAt };
    if (params.get('mode') === 'render') return;
    // Preview: play it on a loop in real time.
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      renderAt(((performance.now() - start) / 1000) % DURATION + 0.0001);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden',
      background: 'radial-gradient(ellipse 70% 55% at 50% 45%, #1c1508 0%, #07070d 70%)' }}>
      <Canvas frameloop="never" flat dpr={1} gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 40, near: 0.1, far: 150, position: [0, 3, 9] }} style={{ position: 'absolute', inset: 0 }}>
        <Scene />
      </Canvas>
      <Overlays />
    </div>
  );
}
