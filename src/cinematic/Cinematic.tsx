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
import { AttackMove } from '../types/game';
import {
  crossed, easeInCubic, easeInOutCubic, easeInQuad, easeOutBack, easeOutCubic, lerp, now, rng, seg, useCine,
} from './timeline';

// Emoji Fighter: the introduction. A scripted film built from the game's own
// fighter rigs, stages and effects. Proof of concept: the cold open (one
// emoji, then a downpour that spirals into the title) and Cattitude's entrance.

export const DURATION = 10;
export const FPS = 30;
const FORMATS = { vertical: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] } as const;
type Format = keyof typeof FORMATS;

const params = new URLSearchParams(location.search);
const format = (params.get('format') as Format) in FORMATS ? (params.get('format') as Format) : 'vertical';
const [W, H] = FORMATS[format];

const T_VORTEX = 3.0; // the rain starts to spiral in
const T_TITLE = 4.4; // flash + title slam
const T_ARENA = 6.0; // cut to the arena
const T_LAND = 6.75; // Cattitude hits the floor
// The rig eases its height a touch behind the script, so the impact effects
// land a moment later, on the actual touchdown.
const T_IMPACT = T_LAND + 0.08;

const CAT = characters.find((c) => c.id === 'cat')!;
const CAT_ACCENT = accentOf('cat');
const SUNSET = stages.find((s) => s.id === 'sunset-gas-station')!;

// --- Cold open: one emoji, then a downpour that spirals into a vortex ------

const RAIN_EMOJI = ['😼', '🥷', '🤖', '👽', '🐲', '💩', '👻', '🧟', '🦖', '🐙', '🦍', '😈', '🥶', '🐔', '🦄', '🤡', '💥', '🔥', '⚡', '👊'];
const VORTEX_CENTER = new THREE.Vector3(0, 1.5, -1);

interface Drop { emoji: string; start: number; x: number; z: number; speed: number; spin: number; a0: number; r0: number; scale: number }
const DROPS: Drop[] = (() => {
  const r = rng(7);
  const list: Drop[] = [
    // The lone first emoji, falling slowly straight at the camera's eyeline.
    { emoji: '👊', start: 0, x: 0, z: 3.2, speed: 2.6, spin: 1.6, a0: 0, r0: 1.4, scale: 1.25 },
  ];
  for (let i = 0; i < 70; i++) {
    list.push({
      emoji: RAIN_EMOJI[i % RAIN_EMOJI.length],
      start: 1.25 + r() * 1.5,
      x: (r() - 0.5) * 7.5,
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
    const span = 15;
    const fy = top - ((d.speed * fallT) % span);
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
  useFrame(() => { if (ref.current) ref.current.visible = now() < T_ARENA; });
  return (
    <group ref={ref}>
      <hemisphereLight args={['#fff4dc', '#1a1026', 1.2]} />
      <directionalLight position={[3, 6, 8]} intensity={1.4} />
      <pointLight position={[0, 1.5, 1]} intensity={30} distance={12} color="#facc15" />
      {DROPS.map((d, i) => <RainDrop key={i} d={d} />)}
    </group>
  );
}

// --- Cattitude's entrance at the sunset gas station --------------------------

// Cattitude's moves after landing: [time, move].
const MOVES: [number, AttackMove][] = [[7.55, 'punch'], [7.85, 'punch'], [8.3, 'heavy'], [9.15, 'special']];

function Arena() {
  const ref = React.useRef<THREE.Group>(null);
  const vfx = React.useRef<VfxApi>(null);
  const input = React.useRef<FighterInput>(defaultFighterInput(0, 1));
  const prev = React.useRef(0);
  const style = specialStyleOf('cat');

  useFrame(() => {
    const t = now();
    if (ref.current) ref.current.visible = t >= T_ARENA;
    const inp = input.current;
    // Dropping in from the sky, accelerating, then a hard landing.
    const fall = seg(t, T_ARENA + 0.2, T_LAND);
    inp.y = t < T_LAND ? 9 * (1 - easeInQuad(fall)) : 0;
    inp.x = 0;
    inp.facing = 1;
    const done = MOVES.filter(([at]) => t >= at);
    inp.attackSeq = done.length;
    inp.attackMove = done.length ? done[done.length - 1][1] : null;
    inp.charged = t >= 8.75 && t < 9.2;

    const p = prev.current;
    const v = new THREE.Vector3();
    if (vfx.current) {
      if (crossed(p, t, T_IMPACT)) {
        v.set(0, 0.05, 0);
        vfx.current.ring(v, CAT_ACCENT, 2.6, 0.55, true);
        vfx.current.ring(v, '#fde68a', 1.6, 0.4, true);
        v.set(0, 0.3, 0.2);
        vfx.current.burst(v, '#d6b98c', 46, 5.5);
      }
      for (const [at, move] of MOVES) {
        if (!crossed(p, t, at)) continue;
        if (move === 'special') {
          vfx.current.special(style, new THREE.Vector3(0.2, 1.1, 0.2), 1, new THREE.Vector3(2.4, 1.1, 0.2));
        } else {
          v.set(1.25, move === 'heavy' ? 1.5 : 1.1, 0.35);
          vfx.current.burst(v, move === 'heavy' ? '#ff8a3d' : '#ffd84d', move === 'heavy' ? 26 : 14, 5);
          if (move === 'heavy') vfx.current.ring(v, '#ff8a3d', 0.9, 0.25);
        }
      }
    }
    prev.current = t;
  });

  return (
    <group ref={ref} visible={false}>
      <Stage3D stage={SUNSET} />
      <Fighter emoji={CAT.emoji} auraColor={style.color} read={() => input.current} />
      <Vfx ref={vfx} />
    </group>
  );
}

// --- Camera -----------------------------------------------------------------

const shake = (t: number, from: number, dur: number, mag: number) => {
  const k = 1 - seg(t, from, from + dur);
  if (k <= 0 || t < from) return 0;
  return Math.sin(t * 91) * mag * k;
};

function Director() {
  const { camera } = useThree();
  const look = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const t = now();
    const cam = camera as THREE.PerspectiveCamera;
    const portrait = W < H;
    if (t < T_ARENA) {
      // Cold open: follow the lone emoji down, pull back for the downpour,
      // then drift in on the vortex.
      const back = easeInOutCubic(seg(t, 1.1, 2.4));
      const push = easeInOutCubic(seg(t, T_VORTEX, T_TITLE));
      const lone = DROPS[0];
      const loneY = 5.2 - lone.speed * Math.min(t, 1.3);
      const z = lerp(lerp(portrait ? 8 : 7, portrait ? 13 : 11, back), portrait ? 10 : 8.5, push);
      cam.position.set(shake(t, 1.25, 0.6, 0.12), lerp(loneY + 0.4, 1.5, back), z);
      look.set(0, lerp(loneY, 1.5, back), 0);
      cam.fov = 40;
    } else {
      // Cattitude drops in from the top of frame, then the camera settles
      // wide enough for the combo and special, and push in slowly. In portrait
      // the look point sits low so Cattitude rides above the name card.
      const settle = easeInOutCubic(seg(t, T_LAND - 0.05, T_LAND + 0.5));
      const push = easeInOutCubic(seg(t, T_LAND + 0.3, DURATION));
      const dist = portrait ? lerp(9.4, 8.2, push) : lerp(7.5, 6.4, push);
      const sx = shake(t, T_IMPACT, 0.45, 0.16);
      // Kept low enough that the painted sky always fills the top of frame;
      // Cattitude drops in from above.
      const fallLook = portrait ? 1.2 : 1.6;
      const restLook = portrait ? 0.55 : 1.0;
      cam.position.set(lerp(0.2, 0.7, push) + sx, lerp(0.9, 1.3, settle) + sx * 0.6, dist);
      look.set(portrait ? 0.6 : 0.8, lerp(fallLook, restLook, settle), 0);
      cam.fov = 40;
    }
    cam.updateProjectionMatrix();
    cam.lookAt(look);
  });
  return null;
}

// --- DOM overlays (title, flash, name card) -------------------------------

const PX = W / 1080; // design unit: 1px at 1080 wide

function Overlays() {
  const t = useCine((s) => s.t);
  const flash = t < T_TITLE - 0.06 ? 0 : t < T_TITLE ? seg(t, T_TITLE - 0.06, T_TITLE) : 1 - easeOutCubic(seg(t, T_TITLE, T_TITLE + 0.55));

  // Title: slams in, badge pops, tagline fades up, then blasts off.
  const tin = seg(t, T_TITLE, T_TITLE + 0.28);
  const tout = seg(t, T_ARENA - 0.35, T_ARENA);
  const titleOn = t >= T_TITLE && t < T_ARENA;
  const titleScale = lerp(2.4, 1, easeOutBack(tin)) * (1 + 0.6 * easeInCubic(tout));
  const badge = easeOutBack(seg(t, T_TITLE + 0.35, T_TITLE + 0.6));
  const tag = easeOutCubic(seg(t, T_TITLE + 0.55, T_TITLE + 0.9));
  const titleShake = shake(t, T_TITLE, 0.3, 10 * PX);

  // Name card: slides in after the landing.
  const cardIn = easeOutCubic(seg(t, 7.1, 7.5));
  const specialIn = easeOutBack(seg(t, 8.75, 9.05));

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: '"Press Start 2P", monospace', color: '#fff' }}>
      {/* Cinematic vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />

      {titleOn && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '42%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          transform: `translate(${titleShake}px, -50%) scale(${titleScale})`, opacity: 1 - tout }}>
          <div style={{ fontSize: 118 * PX, lineHeight: 1.25, letterSpacing: 8 * PX, textAlign: 'center',
            textShadow: `0 ${10 * PX}px 0 #000, 0 0 ${60 * PX}px rgba(250,204,21,0.45)` }}>
            EMOJI<br />
            <span style={{ position: 'relative' }}>
              FIGHTER
              <span style={{ position: 'absolute', left: '100%', marginLeft: 12 * PX, top: -30 * PX, fontSize: 40 * PX, lineHeight: 1,
                background: '#facc15', color: '#000', padding: `${12 * PX}px ${13 * PX}px ${10 * PX}px`, borderRadius: 12 * PX,
                transform: `rotate(-10deg) scale(${badge})`, textShadow: 'none', boxShadow: `0 ${6 * PX}px 0 #a16207`, letterSpacing: 2 * PX }}>3D</span>
            </span>
          </div>
          <div style={{ marginTop: 50 * PX, fontSize: 30 * PX, letterSpacing: 5 * PX, color: '#e4e4e7', opacity: tag,
            transform: `translateY(${(1 - tag) * 20 * PX}px)`, textShadow: `0 ${4 * PX}px 0 #000` }}>
            16 FIGHTERS · 6 ARENAS
          </div>
        </div>
      )}

      {t >= 7.1 && (
        <div style={{ position: 'absolute', left: 0, bottom: H * 0.13, transform: `translateX(${(cardIn - 1) * W}px)` }}>
          <div style={{ background: `linear-gradient(90deg, ${CAT_ACCENT} 0%, ${CAT_ACCENT}cc 70%, transparent 100%)`, padding: `${26 * PX}px ${80 * PX}px ${26 * PX}px ${56 * PX}px` }}>
            <div style={{ fontSize: 76 * PX, letterSpacing: 6 * PX, textShadow: `0 ${8 * PX}px 0 rgba(0,0,0,0.55)` }}>{CAT.name.toUpperCase()}</div>
          </div>
          <div style={{ marginTop: 22 * PX, marginLeft: 56 * PX, fontSize: 26 * PX, lineHeight: 1.6, letterSpacing: 2 * PX, color: '#f4f4f5',
            textShadow: `0 ${4 * PX}px 0 #000`, maxWidth: W * 0.8 }}>{CAT.description}</div>
          <div style={{ marginTop: 26 * PX, marginLeft: 56 * PX, display: 'inline-block', fontSize: 24 * PX, letterSpacing: 3 * PX,
            background: 'rgba(0,0,0,0.6)', border: `${3 * PX}px solid ${CAT_ACCENT}`, color: '#fde68a', padding: `${14 * PX}px ${18 * PX}px`,
            borderRadius: 12 * PX, transform: `scale(${specialIn})`, transformOrigin: 'left center' }}>
            ✦ SPECIAL · {CAT.specialName.toUpperCase()}
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />
    </div>
  );
}

// --- Clock driver -------------------------------------------------------------

function renderAt(t: number) {
  const { t: prev, take } = useCine.getState();
  flushSync(() => useCine.setState(t < prev ? { t, take: take + 1 } : { t }));
  advance(t);
}

// The 3D scene, remounted fresh for each take.
function Scene() {
  const take = useCine((s) => s.take);
  return (
    <group key={take}>
      <Director />
      <ColdOpen />
      <Arena />
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
