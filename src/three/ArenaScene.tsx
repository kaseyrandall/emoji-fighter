import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGameStore, JUMP_PEAK, isPlayerBlocking } from '../store/gameStore';
import { stages } from '../data/stages';
import { Character } from '../types/game';
import { Fighter } from './Fighter';
import { FighterInput, defaultFighterInput } from './fighterInput';
import { Stage3D } from './Stage3D';
import { Vfx, VfxApi } from './Vfx';
import { specialStyleOf } from './specialStyles';
import * as sfx from '../audio/sfx';

// The game store still simulates the fight on its original 2D coordinates:
// positions are a fighter's left edge as a % of the arena, jumps are px of
// height. These map them into the 3D world (the platform runs along X).
const POS_CENTER = 41; // midpoint of the store's POS_MIN..POS_MAX range
const WORLD_PER_POS = 0.16;
const JUMP_HEIGHT = 2.8; // world units at the store's JUMP_PEAK
const toWorldX = (pos: number) => (pos - POS_CENTER) * WORLD_PER_POS;
const toWorldY = (y: number) => (y / JUMP_PEAK) * JUMP_HEIGHT;
// How far the fight camera sits above its original framing (see CameraRig).
const CAM_LIFT = 0.45;
// Store positions move ~60 steps a second; velocity in world units / second.
const VEL_SCALE = WORLD_PER_POS * 60;

const HIT_COLORS = { punch: '#ffd84d', heavy: '#ff8a3d' } as const;

// Shared, frame-loop-only effect clocks (never trigger React renders).
interface FxState {
  shake: number; // seconds of camera shake remaining
  shakeMag: number;
  hitstop: number; // seconds of frozen animation remaining
  slowmo: number; // seconds of KO slow motion remaining
  zoom: number; // brief camera punch-in, 0..1
}

const koScreen = (s: string) => s === 'roundEnd' || s === 'won' || s === 'lost' || s === 'champion';

function readPlayer(out: FighterInput): FighterInput {
  const s = useGameStore.getState();
  out.x = toWorldX(s.playerPosition);
  out.y = toWorldY(s.playerY);
  // Like any fighting game, the player always squares up to the opponent
  // (walking away is a back-pedal, not a turn).
  out.facing = toWorldX(s.opponentPosition) >= out.x ? 1 : -1;
  out.vel = s.playerVel * VEL_SCALE;
  out.attackSeq = s.playerAttackSeq;
  out.attackMove = s.currentMove === 'punch' || s.currentMove === 'heavy' || s.currentMove === 'special' ? s.currentMove : out.attackMove;
  if (s.hitEvent?.target === 'player' && s.hitEvent.result !== 'dodged') {
    out.hitSeq = s.hitEvent.seq;
    out.hitBlocked = s.hitEvent.result === 'blocked';
    out.hitMove = s.hitEvent.move === 'punch' || s.hitEvent.move === 'heavy' || s.hitEvent.move === 'special' ? s.hitEvent.move : null;
  }
  out.pose = s.roundLoser === 'player' && koScreen(s.gameStatus)
    ? 'ko'
    : (s.gameStatus === 'roundEnd' && s.roundLoser === 'opponent') || s.gameStatus === 'won' || s.gameStatus === 'champion'
    ? 'win'
    : 'fight';
  out.charged = s.specialMeter >= 100 && s.gameStatus === 'playing';
  out.guard = isPlayerBlocking(s);
  return out;
}

function readOpponent(out: FighterInput, lastX: { v: number }): FighterInput {
  const s = useGameStore.getState();
  const x = toWorldX(s.opponentPosition);
  const px = toWorldX(s.playerPosition);
  out.vel = (x - lastX.v) * 60;
  lastX.v = x;
  out.x = x;
  out.y = toWorldY(s.opponentY);
  // The opponent always squares up to the player.
  out.facing = px > x ? 1 : -1;
  out.attackSeq = s.opponentAttackSeq;
  out.attackMove = s.opponentMove;
  if (s.hitEvent?.target === 'opponent' && s.hitEvent.result !== 'dodged') {
    out.hitSeq = s.hitEvent.seq;
    out.hitBlocked = s.hitEvent.result === 'blocked';
    out.hitMove = s.hitEvent.move === 'punch' || s.hitEvent.move === 'heavy' || s.hitEvent.move === 'special' ? s.hitEvent.move : null;
  }
  out.pose = s.roundLoser === 'opponent' && koScreen(s.gameStatus)
    ? 'ko'
    : (s.gameStatus === 'roundEnd' && s.roundLoser === 'player') || s.gameStatus === 'lost'
    ? 'win'
    : 'fight';
  out.charged = false;
  out.guard = s.opponentBlocking && s.gameStatus === 'playing';
  return out;
}

// A side-on fighting-game camera: frames both fighters, dollies out as they
// separate (and on narrow screens), shakes on impact, punches in on supers, and
// sweeps around the ring during the pre-fight VS intro.
function CameraRig({ fx }: { fx: React.MutableRefObject<FxState> }) {
  const { camera, size } = useThree();
  const pos = React.useRef(new THREE.Vector3(0, 3, 12));
  const look = React.useRef(new THREE.Vector3(0, 1.2, 0));
  const introT = React.useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = useGameStore.getState();
    const cam = camera as THREE.PerspectiveCamera;
    const px = toWorldX(s.playerPosition);
    const ox = toWorldX(s.opponentPosition);
    const mid = (px + ox) / 2;
    const sep = Math.abs(px - ox);
    const aspect = size.width / Math.max(1, size.height);

    // Distance needed to keep both fighters (plus margin) in frame horizontally.
    const halfW = sep / 2 + 2.6;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const fitDist = halfW / (tanHalf * aspect);
    let dist = THREE.MathUtils.clamp(Math.max(8.8, fitDist), 8.8, 17);
    dist -= fx.current.zoom * 2.2;

    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    if (s.gameStatus === 'intro') {
      // Slow orbit in front of the ring while the VS card is up.
      introT.current += dt;
      const a = -0.7 + introT.current * 0.35;
      targetPos.set(Math.sin(a) * 11, 2.4 + Math.sin(introT.current * 0.8) * 0.4, Math.cos(a) * 11);
      targetLook.set(0, 1.2, 0);
    } else {
      introT.current = 0;
      const loserX = s.roundLoser === 'player' ? px : s.roundLoser === 'opponent' ? ox : mid;
      const focusX = koScreen(s.gameStatus) ? THREE.MathUtils.lerp(mid, loserX, 0.5) : mid;
      const koPush = koScreen(s.gameStatus) ? 1.5 : 0;
      // Rise with an airborne fighter so a jump never leaves the top of a
      // short landscape phone (or disappears behind the HUD).
      const air = Math.max(toWorldY(s.playerY), toWorldY(s.opponentY)) * 0.45;
      // CAM_LIFT raises the camera and its aim together, which slides the
      // whole scene a little lower on screen.
      targetPos.set(focusX * 0.9, 2.5 + CAM_LIFT + air, dist - koPush);
      // Look a little below the fighters' centres so they sit high enough to
      // clear the on-screen touch controls.
      targetLook.set(focusX * 0.95, 1.05 + CAM_LIFT + air, 0);
    }

    const k = 1 - Math.exp(-(s.gameStatus === 'intro' ? 2.5 : 5) * dt);
    pos.current.lerp(targetPos, k);
    look.current.lerp(targetLook, k);

    // Shake.
    const f = fx.current;
    let sx = 0;
    let sy = 0;
    if (f.shake > 0) {
      f.shake -= dt;
      const m = f.shakeMag * Math.max(0, f.shake / 0.3);
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    f.zoom = Math.max(0, f.zoom - dt * 2.5);

    cam.position.set(pos.current.x + sx, pos.current.y + sy, pos.current.z);
    cam.lookAt(look.current.x + sx * 0.5, look.current.y + sy * 0.5, look.current.z);
  });
  return null;
}

// Reacts to store events (hits, specials, KOs) with 3D effects.
function EventFx({ fx, vfx }: { fx: React.MutableRefObject<FxState>; vfx: React.RefObject<VfxApi> }) {
  const last = React.useRef({
    hit: useGameStore.getState().hitEvent?.seq ?? 0,
    attack: useGameStore.getState().playerAttackSeq,
    oppAttack: useGameStore.getState().opponentAttackSeq,
    status: useGameStore.getState().gameStatus,
  });
  const v = React.useMemo(() => new THREE.Vector3(), []);
  const target = React.useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = useGameStore.getState();
    const f = fx.current;
    f.hitstop = Math.max(0, f.hitstop - dt);
    f.slowmo = Math.max(0, f.slowmo - dt);
    const api = vfx.current;
    if (!api) return;

    // Round transitions: wipe leftover effects; KO triggers slow motion.
    if (s.gameStatus !== last.current.status) {
      if (s.gameStatus === 'roundEnd') {
        f.slowmo = 0.9;
        f.shake = 0.3;
        f.shakeMag = 0.5;
      }
      if (s.gameStatus === 'intro' || s.gameStatus === 'ready') api.clear();
      last.current.status = s.gameStatus;
    }

    // Specials: each character's own effect, aimed at the other fighter.
    const px = toWorldX(s.playerPosition);
    const ox = toWorldX(s.opponentPosition);
    const castSpecial = (casterId: string | undefined, fromX: number, fromY: number, toX: number, toY: number) => {
      const style = specialStyleOf(casterId);
      v.set(fromX, fromY + 1.05, 0.1);
      target.set(toX, toY + 1.05, 0.3);
      api.ring(v, style.color, 1.8, 0.4);
      api.special(style, v, Math.sign(toX - fromX) || 1, target);
      sfx.special(casterId);
    };
    if (s.playerAttackSeq !== last.current.attack) {
      last.current.attack = s.playerAttackSeq;
      if (s.currentMove === 'punch') sfx.punchThrow();
      if (s.currentMove === 'heavy') sfx.heavyWindup();
      if (s.currentMove === 'special') {
        castSpecial(s.selectedCharacter?.id, px, toWorldY(s.playerY), ox, toWorldY(s.opponentY));
        f.zoom = 1;
      }
    }
    if (s.opponentAttackSeq !== last.current.oppAttack) {
      last.current.oppAttack = s.opponentAttackSeq;
      if (s.opponentMove === 'punch') sfx.punchThrow();
      if (s.opponentMove === 'heavy') sfx.heavyWindup();
      if (s.opponentMove === 'special') {
        castSpecial(s.opponent?.id, ox, toWorldY(s.opponentY), px, toWorldY(s.playerY));
        f.zoom = 0.6;
      }
    }

    // A hit landed.
    const h = s.hitEvent;
    if (h && h.seq !== last.current.hit) {
      last.current.hit = h.seq;
      const special = h.move === 'special';
      const target = h.target === 'player'
        ? { x: toWorldX(s.playerPosition), y: toWorldY(s.playerY) }
        : { x: toWorldX(s.opponentPosition), y: toWorldY(s.opponentY) };
      const attackerX = h.target === 'player' ? toWorldX(s.opponentPosition) : toWorldX(s.playerPosition);
      // Sparks fly from the side the blow came from.
      const side = Math.sign(attackerX - target.x) || 1;

      if (h.result !== 'dodged') {
        if (h.move === 'heavy') sfx.heavyImpact(h.result === 'blocked');
        if (h.move === 'punch') sfx.punchImpact(h.result === 'blocked');
      }
      if (h.result === 'dodged') {
        // Whiffed under / over a jump: just call it out on the dodger.
        v.set(target.x, target.y + 2.1, 0.6);
        api.number(v, 'DODGE', '#a5f3fc');
        return;
      }
      if (h.result === 'blocked') {
        // Guarded: a cool spray off the raised gloves, chip damage in the callout.
        v.set(target.x + side * 0.75, target.y + 1.25, 0.5);
        api.burst(v, '#7dd3fc', special ? 30 : 16, 4.5);
        api.ring(v, '#bae6fd', special ? 1.4 : 0.8, 0.22);
        v.set(target.x + side * -0.35, target.y + 2.1, 0.6);
        api.number(v, 'BLOCK', '#7dd3fc');
        f.shake = 0.12;
        f.shakeMag = special ? 0.25 : 0.12;
        f.hitstop = 0.035;
        return;
      }
      v.set(target.x + side * 0.55, target.y + (h.move === 'heavy' ? 1.45 : 1.15), 0.4);
      // A special's impact sparks take the attacker's special colour.
      const attacker = h.target === 'player' ? s.opponent : s.selectedCharacter;
      const color = special
        ? specialStyleOf(attacker?.id).color
        : HIT_COLORS[(h.move as keyof typeof HIT_COLORS) ?? 'punch'] ?? HIT_COLORS.punch;
      api.burst(v, color, special ? 70 : 28, special ? 9 : 6);
      api.burst(v, '#ffffff', special ? 18 : 8, 4);
      if (special || h.move === 'heavy') api.ring(v, color, special ? 2.6 : 0.9, special ? 0.45 : 0.25);
      v.set(target.x + side * -0.35, target.y + 2.1, 0.6);
      api.number(v, `-${h.amount}`, special ? '#fde047' : h.target === 'player' ? '#ff5a5a' : '#ffffff');
      f.shake = special ? 0.4 : 0.22;
      f.shakeMag = special ? 0.55 : 0.25;
      f.hitstop = special ? 0.13 : 0.06;
    }
  });
  return null;
}

function Fighters({ player, opponent, fx }: { player: Character; opponent: Character; fx: React.MutableRefObject<FxState> }) {
  const pIn = React.useRef(defaultFighterInput(toWorldX(15), 1));
  const oIn = React.useRef(defaultFighterInput(toWorldX(65), -1));
  const oLast = React.useRef({ v: toWorldX(65) });
  const timeScale = React.useCallback(() => {
    const f = fx.current;
    if (f.hitstop > 0) return 0.05;
    if (f.slowmo > 0) return 0.35;
    return 1;
  }, [fx]);
  return (
    <>
      <Fighter emoji={player.emoji} auraColor={specialStyleOf(player.id).color} read={() => readPlayer(pIn.current)} timeScale={timeScale} />
      <Fighter emoji={opponent.emoji} auraColor={specialStyleOf(opponent.id).color} read={() => readOpponent(oIn.current, oLast.current)} timeScale={timeScale} />
    </>
  );
}

// Selective subscription: only what the scene graph itself depends on. The
// per-frame values (positions, hits…) are read inside useFrame instead, so the
// React tree never re-renders during play.
function SceneContents() {
  const player = useGameStore((s) => s.selectedCharacter);
  const opponent = useGameStore((s) => s.opponent);
  const stageId = useGameStore((s) => s.currentStage);
  const stage = stages.find((s) => s.id === stageId) ?? stages[0];
  const fx = React.useRef<FxState>({ shake: 0, shakeMag: 0, hitstop: 0, slowmo: 0, zoom: 0 });
  const vfx = React.useRef<VfxApi>(null);
  if (!player || !opponent) return null;
  return (
    <>
      <Stage3D key={stage.id} stage={stage} />
      <Fighters key={`${player.id}-${opponent.id}`} player={player} opponent={opponent} fx={fx} />
      <Vfx ref={vfx} />
      <CameraRig fx={fx} />
      <EventFx fx={fx} vfx={vfx} />
    </>
  );
}

export default function ArenaScene() {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 1.75]}
      flat
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 120, position: [0, 3, 12] }}
    >
      <SceneContents />
    </Canvas>
  );
}
