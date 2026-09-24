import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AttackMove } from '../types/game';
import { FighterInput } from './fighterInput';
import { EmojiBody, EmojiMaterials } from './EmojiBody';
import { glowTexture, shadowTexture } from './textures';

interface FighterProps {
  emoji: string;
  auraColor?: string; // charged-aura tint (the fighter's special colour)
  read: () => FighterInput;
  // Multiplier on animation time — the arena drops it for hitstop / KO slow-mo.
  timeScale?: () => number;
  size?: number;
}

const BODY = 1.8; // glyph size in world units
const ATTACK_DUR: Record<AttackMove, number> = { punch: 0.3, heavy: 0.42, special: 0.65 };

const circle = new THREE.PlaneGeometry(1, 1);

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const damp = (cur: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-lambda * dt));
// Snap-out / ease-back curve for a strike: fast extension, slower recovery.
const strike = (p: number, peak: number) =>
  p < peak ? easeOut(p / peak) : 1 - easeIn(clamp01((p - peak) / (1 - peak)));

// Rest positions, in the fighter's local space (forward = -X, the way emoji
// glyphs naturally face; the rig turns 180° to face right).
const LEAD_GLOVE = new THREE.Vector3(-0.95, 0.95, 0.45);
const REAR_GLOVE = new THREE.Vector3(-0.55, 1.2, -0.4);
const tmp = new THREE.Vector3();
const pulseOf = (t: number) => Math.sin(t * 6);

// Gloves are small emoji cutouts too. The 🥊 glyph punches toward screen-right,
// so it's mirrored to point along the rig's forward (-X) axis.
const GLOVE = '🥊';
const GLOVE_SIZE = 0.62;

// A Rayman-style emoji brawler: a thick stamped emoji body with floating
// gloves. Handles idle bounce, running lean, turning, jumping, jab /
// uppercut / special swings, hit recoil + flash, the charged aura, and the
// KO topple / victory hop — all procedurally, every frame.
export function Fighter({ emoji, auraColor = '#d8b4fe', read, timeScale, size = 1 }: FighterProps) {
  const root = React.useRef<THREE.Group>(null);
  const lift = React.useRef<THREE.Group>(null);
  const yaw = React.useRef<THREE.Group>(null);
  const body = React.useRef<THREE.Group>(null);
  const spin = React.useRef<THREE.Group>(null);
  const leadGlove = React.useRef<THREE.Group>(null);
  const rearGlove = React.useRef<THREE.Group>(null);
  const gloveMats = React.useRef<EmojiMaterials[]>([]);
  const shadow = React.useRef<THREE.Mesh>(null);
  const aura = React.useRef<THREE.Sprite>(null);
  const sparkles = React.useRef<THREE.Group>(null);
  const mats = React.useRef<EmojiMaterials | null>(null);

  const auraMat = React.useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: auraColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [auraColor]
  );
  const sparkleMat = React.useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    []
  );
  const shadowMat = React.useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    []
  );
  React.useEffect(() => () => { auraMat.dispose(); sparkleMat.dispose(); shadowMat.dispose(); }, [auraMat, sparkleMat, shadowMat]);

  // Animation state, mutated in the frame loop (never triggers a React render).
  const anim = React.useRef({
    t: Math.random() * 10,
    x: read().x,
    y: 0,
    yaw: read().facing === 1 ? Math.PI + 0.3 : -0.3,
    lastAttackSeq: read().attackSeq,
    lastHitSeq: read().hitSeq,
    attack: null as null | { move: AttackMove; t: number },
    hit: null as null | { t: number; force: number },
    ko: 0, // 0..1 topple progress
    win: 0,
    charge: 0,
    lean: 0,
  });

  useFrame((_, rawDt) => {
    const inp = read();
    const a = anim.current;
    const dt = Math.min(rawDt, 1 / 20) * (timeScale ? timeScale() : 1);
    a.t += dt;

    // New attack / hit edges.
    if (inp.attackSeq !== a.lastAttackSeq) {
      a.lastAttackSeq = inp.attackSeq;
      if (inp.attackMove) a.attack = { move: inp.attackMove, t: 0 };
    }
    if (inp.hitSeq !== a.lastHitSeq) {
      a.lastHitSeq = inp.hitSeq;
      a.hit = { t: 0, force: inp.hitMove === 'special' ? 1.6 : inp.hitMove === 'heavy' ? 1.3 : 1 };
    }

    // Follow the simulation smoothly (it ticks at a fixed rate; we render at
    // whatever the display runs at).
    a.x = damp(a.x, inp.x, 22, rawDt);
    a.y = damp(a.y, inp.y, 30, rawDt);
    const targetYaw = inp.facing === 1 ? Math.PI + 0.3 : -0.3;
    a.yaw = damp(a.yaw, targetYaw, 14, dt);
    a.ko = damp(a.ko, inp.pose === 'ko' ? 1 : 0, inp.pose === 'ko' ? 7 : 10, dt);
    a.win = damp(a.win, inp.pose === 'win' ? 1 : 0, 8, dt);
    a.charge = damp(a.charge, inp.charged ? 1 : 0, 6, dt);
    // Lean into movement, in the fighter's own forward direction.
    const forwardVel = inp.vel * inp.facing;
    a.lean = damp(a.lean, THREE.MathUtils.clamp(forwardVel * 0.09, -0.22, 0.22), 10, dt);

    const airborne = a.y > 0.05;

    // --- Base (idle) pose ---
    const bounce = inp.pose === 'fight' ? Math.sin(a.t * 7) : Math.sin(a.t * 2) * 0.3;
    let bodyX = 0;
    let bodyY = bounce * 0.035;
    let bodyRotZ = a.lean + Math.sin(a.t * 3.5) * 0.02;
    let bodyScaleY = 1 + bounce * 0.015;
    let spinY = 0;
    const lg = tmp.copy(LEAD_GLOVE);
    lg.y += Math.sin(a.t * 7 + 1) * 0.06;
    const rg = REAR_GLOVE.clone();
    rg.y += Math.sin(a.t * 7 + 2.2) * 0.06;
    let gloveScale = 1;
    let rearScale = 1;

    // Running: a bouncy hop in step with the stride.
    if (!airborne && Math.abs(inp.vel) > 0.4 && inp.pose === 'fight') {
      const stride = a.t * 16;
      bodyY += Math.abs(Math.sin(stride)) * 0.06;
      lg.x += Math.sin(stride) * 0.08;
      rg.x -= Math.sin(stride) * 0.08;
    }

    // Airborne: raise the guard.
    if (airborne) {
      lg.y += 0.2; rg.y += 0.25;
      bodyScaleY *= 1.04;
    }

    // --- Attack swing ---
    if (a.attack) {
      const dur = ATTACK_DUR[a.attack.move];
      a.attack.t += dt;
      const p = clamp01(a.attack.t / dur);
      if (a.attack.move === 'punch') {
        const e = strike(p, 0.3);
        lg.lerp(new THREE.Vector3(-1.9, 1.05, 0.25), e);
        bodyRotZ += 0.2 * e;
        bodyX -= 0.22 * e;
        gloveScale = 1 + 0.25 * e;
      } else if (a.attack.move === 'heavy') {
        // Uppercut with the rear glove: dip and draw back, then swing it up
        // and through in front of the body.
        const windup = Math.sin(clamp01(p / 0.3) * Math.PI * 0.5) * (1 - clamp01((p - 0.3) / 0.15));
        const e = strike(clamp01((p - 0.25) / 0.75), 0.3);
        rg.lerp(new THREE.Vector3(0.1, 0.45, 0.2), windup);
        rg.lerp(new THREE.Vector3(-1.7, 1.85, 0.45), e);
        lg.lerp(new THREE.Vector3(-0.7, 1.35, 0.5), Math.max(windup, e));
        bodyY += -0.1 * windup + 0.16 * e;
        bodyRotZ += -0.12 * windup + 0.28 * e;
        bodyX -= 0.25 * e;
        rearScale = 1 + 0.45 * e;
      } else {
        // Special: wind up, spin, then both gloves thrust out.
        const windup = clamp01(p / 0.25);
        const thrust = strike(clamp01((p - 0.25) / 0.75), 0.3);
        spinY = easeOut(clamp01(p / 0.6)) * Math.PI * 2;
        bodyScaleY = 1 + 0.18 * Math.sin(Math.min(1, p / 0.6) * Math.PI);
        lg.lerp(new THREE.Vector3(-2.1, 1.1, 0.3), thrust);
        rg.lerp(new THREE.Vector3(-2.0, 0.9, -0.2), thrust);
        bodyX += 0.2 * windup - 0.4 * thrust;
        gloveScale = 1 + 0.4 * thrust;
      }
      if (p >= 1) a.attack = null;
    }

    // --- Hit recoil + flash ---
    let flash = 0;
    if (a.hit) {
      a.hit.t += dt;
      const dur = 0.2 + 0.16 * a.hit.force;
      const p = clamp01(a.hit.t / dur);
      const k = Math.sin(p * Math.PI) * a.hit.force;
      bodyRotZ -= 0.3 * k;
      bodyX += 0.28 * k;
      bodyScaleY *= 1 - 0.08 * k;
      flash = 1 - p;
      if (p >= 1) a.hit = null;
    }

    // --- Victory hop ---
    if (a.win > 0.01) {
      const hop = Math.abs(Math.sin(a.t * 6)) * 0.35 * a.win;
      bodyY += hop;
      lg.lerp(new THREE.Vector3(-0.8, 2.2, 0.3), a.win);
      rg.lerp(new THREE.Vector3(0.6, 2.25, 0.1), a.win);
    }

    // --- KO topple: the whole rig falls backward about the feet ---
    const koRot = -1.42 * easeOut(a.ko);
    if (a.ko > 0.01) {
      lg.lerp(new THREE.Vector3(0.2, 0.25, 0.7), a.ko);
      rg.lerp(new THREE.Vector3(1.1, 0.2, -0.5), a.ko);
    }

    // Apply.
    root.current!.position.set(a.x, 0, 0);
    lift.current!.position.y = a.y;
    lift.current!.scale.setScalar(size);
    yaw.current!.rotation.y = a.yaw;
    body.current!.position.set(bodyX, bodyY, 0);
    body.current!.rotation.z = bodyRotZ + koRot;
    body.current!.scale.set(1 / Math.sqrt(bodyScaleY), bodyScaleY, 1);
    spin.current!.rotation.y = spinY;
    leadGlove.current!.position.copy(lg);
    rearGlove.current!.position.copy(rg);
    leadGlove.current!.scale.setScalar(gloveScale);
    rearGlove.current!.scale.setScalar(0.9 * gloveScale * rearScale);

    // Contact shadow shrinks and fades as the fighter rises.
    const h = a.y;
    const s = Math.max(0.35, 1 - h * 0.18) * size;
    shadow.current!.scale.set(2.1 * s * (1 + a.ko * 0.6), 0.75 * s, 1);
    shadowMat.opacity = Math.max(0.25, 1 - h * 0.2);

    // Hit flash: push the art toward hot red, briefly.
    const m = mats.current;
    if (m) {
      m.face.emissive.setRGB(1, 1 - flash * 0.85, 1 - flash * 0.85);
      m.face.emissiveIntensity = 0.3 + flash * 0.9;
    }
    for (const g of gloveMats.current) g.face.emissiveIntensity = 0.3 + a.charge * 0.35 * (1 + pulseOf(a.t));

    // Charged aura + orbiting sparkles.
    const pulse = 0.5 + 0.5 * Math.sin(a.t * 6);
    auraMat.opacity = a.charge * (0.45 + 0.35 * pulse);
    aura.current!.scale.setScalar(3.2 + pulse * 0.5);
    sparkles.current!.visible = a.charge > 0.05;
    sparkles.current!.rotation.y = a.t * 2.6;
    sparkleMat.opacity = a.charge;
  });

  return (
    <group ref={root}>
      <mesh ref={shadow} geometry={circle} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={1} />
      <group ref={lift}>
        <sprite ref={aura} material={auraMat} position={[0, 1.05, -0.3]} />
        <group ref={sparkles} position={[0, 1.05, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <sprite
              key={i}
              material={sparkleMat}
              position={[Math.cos((i * Math.PI) / 2) * 1.25, (i % 2 ? 0.45 : -0.35), Math.sin((i * Math.PI) / 2) * 1.25]}
              scale={0.35}
            />
          ))}
        </group>
        <group ref={yaw}>
          <group ref={body}>
            <group ref={spin} position={[0, BODY / 2 + 0.02, 0]}>
              <EmojiBody emoji={emoji} size={BODY} depth={0.34} layers={10} onMaterials={(m) => (mats.current = m)} />
            </group>
          </group>
          {/* The rear glove sits behind the body, the lead glove in front. */}
          <group ref={rearGlove}>
            <group scale={[-1, 1, 1]}>
              <EmojiBody emoji={GLOVE} size={GLOVE_SIZE} depth={0.16} layers={4} onMaterials={(m) => (gloveMats.current[1] = m)} />
            </group>
          </group>
          <group ref={leadGlove}>
            <group scale={[-1, 1, 1]}>
              <EmojiBody emoji={GLOVE} size={GLOVE_SIZE} depth={0.16} layers={4} onMaterials={(m) => (gloveMats.current[0] = m)} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
