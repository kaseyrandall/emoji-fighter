import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveQuality } from './AdaptiveQuality';
import { initialDpr } from '../store/qualityStore';
import { Character, AttackMove } from '../types/game';
import { accentOf } from '../data/accents';
import { Fighter } from './Fighter';
import { defaultFighterInput } from './fighterInput';
import { glowTexture } from './textures';
import { Vfx, VfxApi } from './Vfx';
import { specialStyleOf } from './specialStyles';
import * as sfx from '../audio/sfx';

const DEMO: AttackMove[] = ['punch', 'heavy', 'punch', 'special'];

// The selected fighter on a slowly turning pedestal, lit in its signature
// colour, running through its moves. Switching fighters pops the new one in.
function Showcase({ character }: { character: Character }) {
  const accent = accentOf(character.id);
  const turntable = React.useRef<THREE.Group>(null);
  const pop = React.useRef<THREE.Group>(null);
  const input = React.useRef(defaultFighterInput(0, -1));
  const clock = React.useRef({ t: 0, next: 1.1, step: 0, popT: 0 });
  const vfx = React.useRef<VfxApi>(null);
  const style = specialStyleOf(character.id);
  // The special's sound plays with the first demo after picking a fighter
  // (not on every loop of the turntable).
  const heard = React.useRef('');

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const c = clock.current;
    c.t += dt;
    c.popT += dt;
    const inp = input.current;
    if (c.t > c.next) {
      const m = DEMO[c.step % DEMO.length];
      c.step++;
      inp.attackMove = m;
      inp.attackSeq++;
      c.next = c.t + (m === 'special' ? 1.8 : 1.0);
      // Preview the fighter's own special effect.
      if (m === 'special' && vfx.current) {
        const from = new THREE.Vector3(0, 1.05, 0.1);
        vfx.current.special(style, from, -1, new THREE.Vector3(-1.5, 1.05, 0.3));
        if (heard.current !== character.id) {
          heard.current = character.id;
          sfx.special(character.id);
        }
      }
    }
    inp.charged = DEMO[c.step % DEMO.length] === 'special';
    if (turntable.current) turntable.current.rotation.y = Math.sin(c.t * 0.5) * 0.55;
    if (pop.current) {
      // Elastic pop-in.
      const p = Math.min(1, c.popT / 0.5);
      const s = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p) * Math.cos(p * Math.PI * 3);
      pop.current.scale.setScalar(Math.max(0.01, s));
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#1a1026', 1.1]} />
      <directionalLight position={[3, 6, 6]} intensity={1.4} />
      <pointLight position={[-2.5, 2.5, -1.5]} intensity={18} distance={10} color={accent} />
      {/* Kept small enough to fade out before the canvas edges, so it never
          shows as a hard-edged box. */}
      <sprite position={[0, 1.3, -2.5]} scale={[4.2, 4.2, 1]}>
        <spriteMaterial map={glowTexture()} color={accent} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <group ref={turntable}>
        {/* Pedestal */}
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[1.5, 1.65, 0.36, 48]} />
          <meshStandardMaterial color="#1c1a26" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.32, 1.46, 48]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        <group ref={pop}>
          <Fighter emoji={character.emoji} auraColor={style.color} read={() => input.current} />
        </group>
      </group>
      <Vfx ref={vfx} />
    </>
  );
}

// Frames the pedestal: on a tall, narrow panel (e.g. an iPad's hero column)
// the camera steps back so the fighter and its gloves still fit the width.
function PreviewCamera() {
  const { camera, size } = useThree();
  React.useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const back = Math.max(1, 0.95 / aspect);
    camera.position.set(0, 1.9 * back, 6.6 * back);
    camera.lookAt(0, 1.05, 0);
  }, [camera, size.width, size.height]);
  return null;
}

export default function FighterPreview({ character }: { character: Character }) {
  return (
    <Canvas
      dpr={initialDpr()}
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 32, near: 0.1, far: 40, position: [0, 1.9, 6.6] }}
    >
      <PreviewCamera />
      <AdaptiveQuality />
      <Showcase key={character.id} character={character} />
    </Canvas>
  );
}
