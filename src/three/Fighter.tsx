import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AttackMove } from '../types/game';
import { FighterInput } from './fighterInput';
import { EmojiBody, EmojiMaterials } from './EmojiBody';
import { glowTexture, shadowTexture } from './textures';

interface FighterProps {
  emoji: string;
  accent: string;
  read: () => FighterInput;
  // Multiplier on animation time — the arena drops it for hitstop / KO slow-mo.
  timeScale?: () => number;
  size?: number;
}

const BODY = 1.8; // glyph size in world units
const ATTACK_DUR: Record<AttackMove, number> = { punch: 0.3, kick: 0.42, special: 0.65 };

const sphere = new THREE.SphereGeometry(1, 20, 14);
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
const LEAD_BOOT = new THREE.Vector3(-0.35, 0.14, 0.25);
const REAR_BOOT = new THREE.Vector3(0.4, 0.14, -0.2);
const tmp = new THREE.Vector3();

// A Rayman-style emoji brawler: a thick stamped emoji body with floating
// gloves and boots. Handles idle bounce, running lean, turning, jumping,
// punch / kick / special swings, hit recoil + flash, the charged aura, and the
// KO topple / victory hop — all procedurally, every frame.
export function Fighter({ emoji, accent, read, timeScale, size = 1 }: FighterProps) {
  const root = React.useRef<THREE.Group>(null);
  const lift = React.useRef<THREE.Group>(null);
  const yaw = React.useRef<THREE.Group>(null);
  const body = React.useRef<THREE.Group>(null);
  const spin = React.useRef<THREE.Group>(null);
  const leadGlove = React.useRef<THREE.Mesh>(null);
  const rearGlove = React.useRef<THREE.Mesh>(null);
  const leadBoot = React.useRef<THREE.Mesh>(null);
  const rearBoot = React.useRef<THREE.Mesh>(null);
  const shadow = React.useRef<THREE.Mesh>(null);
  const aura = React.useRef<THREE.Sprite>(null);
  const sparkles = React.useRef<THREE.Group>(null);
  const mats = React.useRef<EmojiMaterials | null>(null);

  const glove = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.1, emissive: accent, emissiveIntensity: 0.18 }),
    [accent]
  );
  const boot = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).multiplyScalar(0.55), roughness: 0.5 }),
    [accent]
  );
  const auraMat = React.useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#d8b4fe', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    []
  );
  const sparkleMat = React.useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    []
  );
  const shadowMat = React.useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    []
  );
  React.useEffect(() => () => { glove.dispose(); boot.dispose(); }, [glove, boot]);
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
    hit: null as null | { t: number; heavy: boolean },
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
      a.hit = { t: 0, heavy: inp.hitMove === 'special' };
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
    const lb = LEAD_BOOT.clone();
    const rb = REAR_BOOT.clone();
    let gloveScale = 1;

    // Running: little alternating steps.
    if (!airborne && Math.abs(inp.vel) > 0.4 && inp.pose === 'fight') {
      const stride = a.t * 16;
      lb.y += Math.max(0, Math.sin(stride)) * 0.18;
      rb.y += Math.max(0, -Math.sin(stride)) * 0.18;
      lb.x += Math.sin(stride) * 0.12;
      rb.x -= Math.sin(stride) * 0.12;
    }

    // Airborne: tuck the feet and raise the guard.
    if (airborne) {
      lb.y += 0.3; rb.y += 0.35;
      lb.x += 0.15; rb.x -= 0.1;
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
      } else if (a.attack.move === 'kick') {
        const e = strike(p, 0.35);
        lb.lerp(new THREE.Vector3(-1.85, 0.8, 0.2), e);
        bodyRotZ -= 0.32 * e;
        bodyX += 0.1 * e;
        bodyY += 0.12 * e;
        lg.y += 0.25 * e;
        rg.y += 0.2 * e;
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
      const dur = a.hit.heavy ? 0.45 : 0.28;
      const p = clamp01(a.hit.t / dur);
      const k = Math.sin(p * Math.PI) * (a.hit.heavy ? 1.6 : 1);
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
    leadGlove.current!.scale.setScalar(0.24 * gloveScale);
    rearGlove.current!.scale.setScalar(0.22 * gloveScale);
    leadBoot.current!.position.copy(lb);
    rearBoot.current!.position.copy(rb);
    const bootsDown = 1 - a.ko;
    leadBoot.current!.visible = rearBoot.current!.visible = bootsDown > 0.3;

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
    glove.emissiveIntensity = 0.18 + a.charge * 0.5 + flash * 0.4;

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
          <mesh ref={rearGlove} geometry={sphere} material={glove} />
          <mesh ref={leadGlove} geometry={sphere} material={glove} />
          <mesh ref={leadBoot} geometry={sphere} material={boot} scale={[0.26, 0.15, 0.2]} />
          <mesh ref={rearBoot} geometry={sphere} material={boot} scale={[0.26, 0.15, 0.2]} />
        </group>
      </group>
    </group>
  );
}
