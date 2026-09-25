import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveQuality } from './AdaptiveQuality';
import { initialDpr, useQuality } from '../store/qualityStore';
import { characters } from '../data/characters';
import { specialStyleOf } from './specialStyles';
import { AttackMove } from '../types/game';
import { EmojiBody } from './EmojiBody';
import { Fighter } from './Fighter';
import { defaultFighterInput } from './fighterInput';
import { glowTexture } from './textures';

const RAIN = ['🥷', '🤖', '👽', '🐲', '💩', '👊', '🦾', '💥', '⚡️', '🔥'];
const RAIN_COUNT = 26;
const TOP = 11;
const BOTTOM = -11;

interface Drop {
  emoji: string;
  x: number;
  y: number;
  z: number;
  speed: number;
  spin: THREE.Vector3;
  scale: number;
}

// `spread` is how wide (world units) the rain falls: narrower in portrait.
const makeDrop = (y?: number, spread = 26): Drop => ({
  emoji: RAIN[Math.floor(Math.random() * RAIN.length)],
  x: (Math.random() - 0.5) * spread,
  y: y ?? TOP + Math.random() * 4,
  z: -12 + Math.random() * 10,
  speed: 1.2 + Math.random() * 2.4,
  // Mostly a flat spin with a gentle wobble, so the art stays readable
  // instead of tumbling edge-on into dark slivers.
  spin: new THREE.Vector3(0.6 + Math.random(), 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 2.5),
  scale: 0.6 + Math.random() * 1.1,
});

// One falling, tumbling 3D emoji. It respawns at the top with a fresh glyph
// (re-keyed by the parent) once it falls out of view.
function RainDrop({ initial, spread, sizeScale = 1 }: { initial: Drop; spread: number; sizeScale?: number }) {
  const ref = React.useRef<THREE.Group>(null);
  const [drop, setDrop] = React.useState(initial);
  const d = React.useRef(drop);
  d.current = drop;
  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(rawDt, 1 / 20);
    g.position.y -= d.current.speed * dt;
    const t = g.position.y;
    g.rotation.x = Math.sin(t * 0.5 * d.current.spin.x) * 0.45;
    g.rotation.y = Math.sin(t * 0.4 * d.current.spin.y) * 0.7;
    g.rotation.z += d.current.spin.z * dt;
    if (g.position.y < BOTTOM) {
      const next = makeDrop(undefined, spread);
      g.position.set(next.x, next.y, next.z);
      setDrop(next);
    }
  });
  return (
    <group ref={ref} position={[initial.x, initial.y, initial.z]} scale={drop.scale * sizeScale}>
      <EmojiBody emoji={drop.emoji} size={1.3} depth={0.22} layers={4} />
    </group>
  );
}

// A fighter shadow-boxing on the title screen: throws a scripted combo every
// so often and powers up now and then.
function Showboater({ id, x, facing, delay }: { id: string; x: number; facing: 1 | -1; delay: number }) {
  const c = characters.find((ch) => ch.id === id) ?? characters[0];
  const input = React.useRef(defaultFighterInput(x, facing));
  const t = React.useRef(-delay);
  const next = React.useRef(0.6);
  const moves: AttackMove[] = ['punch', 'punch', 'heavy', 'punch', 'heavy', 'special'];
  const step = React.useRef(0);
  useFrame((_, dt) => {
    t.current += Math.min(dt, 1 / 20);
    const inp = input.current;
    if (t.current > next.current) {
      const m = moves[step.current % moves.length];
      step.current++;
      inp.attackMove = m;
      inp.attackSeq++;
      next.current = t.current + (m === 'special' ? 1.6 : 0.45 + Math.random() * 0.5);
    }
    // Aura builds up just before the special.
    inp.charged = moves[step.current % moves.length] === 'special';
  });
  return <Fighter emoji={c.emoji} auraColor={specialStyleOf(c.id).color} read={() => input.current} />;
}

function Rig() {
  const { camera, pointer } = useThree();
  const target = React.useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    // Gentle parallax following the pointer (or finger).
    target.set(pointer.x * 1.4, 0.4 + pointer.y * 0.8, 13);
    camera.position.lerp(target, 1 - Math.exp(-2.5 * Math.min(dt, 1 / 20)));
    camera.lookAt(0, -0.4, 0);
  });
  return null;
}

function Contents() {
  const quality = useQuality((q) => q.level);
  // Portrait phones: the view is narrow and tall, so the rain falls in a
  // narrower band and the sparring pair moves below the title and buttons,
  // side by side, instead of flanking the title off-screen.
  const portrait = useThree((s) => s.size.width < s.size.height * 0.9);
  const spread = portrait ? 7 : 26;
  const drops = React.useMemo(
    () => Array.from({ length: RAIN_COUNT }, () => makeDrop(BOTTOM + Math.random() * (TOP - BOTTOM), spread)),
    [spread]
  );
  const pairX = portrait ? 1.3 : 5.4;
  const pairY = portrait ? -4.3 : -2.6;
  const pairScale = portrait ? 0.55 : 1;
  // Smaller falling emoji in the narrow portrait view.
  const dropScale = portrait ? 0.6 : 1;
  // Two different random fighters face off either side of the title.
  const pair = React.useMemo(() => {
    const pool = [...characters].sort(() => Math.random() - 0.5);
    return [pool[0].id, pool[1].id];
  }, []);
  return (
    <>
      <color attach="background" args={['#07070d']} />
      <fog attach="fog" args={['#07070d', 18, 42]} />
      <hemisphereLight args={['#ffe9c4', '#1a1030', 1.2]} />
      <directionalLight position={[5, 8, 8]} intensity={1.4} color="#fff1dd" />
      <directionalLight position={[-6, 3, -4]} intensity={1.4} color="#a855f7" />
      {/* Warm spotlight glow behind the title */}
      <sprite position={[0, 0.8, -8]} scale={[22, 12, 1]}>
        <spriteMaterial map={glowTexture()} color="#f59e0b" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* Half the rain when the device needs lighter rendering. */}
      {drops.slice(0, quality >= 2 ? RAIN_COUNT / 2 : RAIN_COUNT).map((d, i) => (
        <RainDrop key={`${spread}-${i}`} initial={d} spread={spread} sizeScale={dropScale} />
      ))}
      <group position={[0, pairY, 0]} scale={pairScale}>
        {/* A glowing pedestal under each fighter */}
        {[-pairX / pairScale, pairX / pairScale].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, -0.16, 0]}>
              <cylinderGeometry args={[1.4, 1.55, 0.3, 40]} />
              <meshStandardMaterial color="#1c1826" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
              <ringGeometry args={[1.22, 1.36, 40]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          </group>
        ))}
        <group position={[-pairX / pairScale, 0, 0]}>
          <Showboater id={pair[0]} x={0} facing={1} delay={0} />
        </group>
        <group position={[pairX / pairScale, 0, 0]}>
          <Showboater id={pair[1]} x={0} facing={-1} delay={0.7} />
        </group>
      </group>
      <Rig />
    </>
  );
}

export default function LandingScene() {
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={initialDpr()}
      flat
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 80, position: [0, 0.4, 13] }}
      // The title/buttons sit above the canvas; listen on the whole page so
      // the pointer parallax still follows the cursor over them.
      eventSource={document.getElementById('root') ?? undefined}
      eventPrefix="client"
    >
      <AdaptiveQuality />
      <Contents />
    </Canvas>
  );
}
