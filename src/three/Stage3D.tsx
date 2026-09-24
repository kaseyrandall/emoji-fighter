import React from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { Stage } from '../types/game';
import { FloorPattern, floorTexture, glowTexture } from './textures';

// Per-stage 3D dressing: the painted stage art wraps a curved backdrop, a
// textured fight platform sits in front of it, and each stage adds its own
// props, lighting and drifting ambient particles for depth and parallax.

type Props = 'canopy' | 'pirate' | 'temple' | 'factory' | 'subway';

interface Theme {
  floor: { pattern: FloorPattern; base: string; line: string; repeat: [number, number] };
  trim: string; // front-lip accent
  fog: string;
  sky: string; // hemisphere light, sky side
  ground: string; // hemisphere light, ground side
  key: string; // main directional light
  rim: string; // back/side light
  motes: string; // ambient particle colour
  props: Props;
  // Fraction of the painting (from the bottom) that is painted floor. It's
  // cropped away so the real 3D platform runs back to the painted horizon.
  paintedFloor: number;
}

const THEMES: Record<string, Theme> = {
  'canopy-arena': {
    floor: { pattern: 'planks', base: '#8a5530', line: '#3b2210', repeat: [3, 1.2] },
    trim: '#ffcf7a', fog: '#1d2a1b', sky: '#ffe2b0', ground: '#2d1c0f', key: '#ffc98a', rim: '#8dffc4', motes: '#ffe38a', props: 'canopy', paintedFloor: 0.32,
  },
  'pirate-cove': {
    floor: { pattern: 'deck', base: '#96643a', line: '#3a2413', repeat: [3, 1.2] },
    trim: '#ffb46b', fog: '#3a2233', sky: '#ffd0a8', ground: '#2a1a24', key: '#ffb070', rim: '#ff7ab0', motes: '#ffd9b0', props: 'pirate', paintedFloor: 0.3,
  },
  'jungle-temple': {
    floor: { pattern: 'stone', base: '#7a7766', line: '#34332a', repeat: [3, 1.2] },
    trim: '#a7ff8a', fog: '#1b2a1e', sky: '#f4ffd8', ground: '#23301f', key: '#fff0c4', rim: '#6fffa0', motes: '#c6ff9a', props: 'temple', paintedFloor: 0.33,
  },
  'emoji-factory': {
    floor: { pattern: 'hazard', base: '#4f545d', line: '#1d2026', repeat: [4, 1.4] },
    trim: '#ffd23f', fog: '#2a2418', sky: '#fff6dc', ground: '#2a2620', key: '#fff1cc', rim: '#ffcf3f', motes: '#ffb347', props: 'factory', paintedFloor: 0.4,
  },
  'neon-subway': {
    floor: { pattern: 'tiles', base: '#2c2638', line: '#6a5790', repeat: [4, 1.4] },
    trim: '#ffe14d', fog: '#140f24', sky: '#d6c6ff', ground: '#1b1030', key: '#cdb8ff', rim: '#ff3fd0', motes: '#ff7ae6', props: 'subway', paintedFloor: 0.39,
  },
};

const themeOf = (id: string) => THEMES[id] ?? THEMES['canopy-arena'];

// Painted art on the inside of a cylinder arc, well behind the fighters. The
// curve means a sideways-tracking camera sees it shift gently in perspective
// instead of sliding like a flat billboard.
function Backdrop({ url, paintedFloor }: { url: string; paintedFloor: number }) {
  const tex = useLoader(THREE.TextureLoader, url);
  const geo = React.useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const img = tex.image as { width: number; height: number };
    const aspect = img.width / img.height || 16 / 9;
    const R = 26;
    const arc = 1.75; // radians of the cylinder the art spans
    const keep = 1 - paintedFloor;
    const H = ((R * arc) / aspect) * keep;
    const g = new THREE.CylinderGeometry(R, R, H, 48, 1, true, Math.PI - arc / 2, arc);
    // Seen from inside, the U axis runs mirrored — flip it back — and V is
    // remapped to the part of the painting above its floor.
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), paintedFloor + uv.getY(i) * keep);
    // Bottom edge just under the platform surface, so floor meets horizon.
    g.translate(0, H / 2 - 0.15, 9);
    return g;
  }, [tex, paintedFloor]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} color="#d9d9d9" toneMapped={false} />
    </mesh>
  );
}

function Floor({ theme }: { theme: Theme }) {
  const tex = React.useMemo(() => {
    const t = floorTexture(theme.floor.pattern, theme.floor.base, theme.floor.line).clone();
    t.needsUpdate = true;
    t.repeat.set(theme.floor.repeat[0] * 1.33, theme.floor.repeat[1] * 2.1);
    return t;
  }, [theme]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group>
      {/* Fight platform */}
      <mesh position={[0, -0.25, -5.5]}>
        <boxGeometry args={[40, 0.5, 23]} />
        <meshStandardMaterial map={tex} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Glowing front lip + a fainter back line: frames the play space. */}
      <mesh position={[0, 0.01, 2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 0.06]} />
        <meshBasicMaterial color={theme.trim} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.01, -2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 0.04]} />
        <meshBasicMaterial color={theme.trim} transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Slowly drifting additive motes (fireflies, embers, spores, sparks, dust).
function Motes({ color, count = 70 }: { color: string; count?: number }) {
  const ref = React.useRef<THREE.Points>(null);
  const { geo, seeds } = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = -8 + Math.random() * 11;
      s[i] = Math.random() * 100;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, seeds: s };
  }, [count]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const a = geo.attributes.position as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += Math.sin(t * 0.4 + seeds[i]) * dt * 0.3;
      arr[i * 3 + 1] += (0.15 + Math.sin(t + seeds[i]) * 0.2) * dt;
      if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = -0.2;
    }
    a.needsUpdate = true;
    const m = ref.current?.material as THREE.PointsMaterial | undefined;
    if (m) m.opacity = 0.65 + Math.sin(t * 2) * 0.15;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.2}
        map={glowTexture()}
        color={color}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// A soft additive glow disc — fakes a light source's bloom without post-FX.
function Glow({ position, color, scale = 1.6, opacity = 0.7 }: { position: [number, number, number]; color: string; scale?: number; opacity?: number }) {
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={glowTexture()} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

// --- Per-stage props -------------------------------------------------------

function Lantern({ position, phase = 0 }: { position: [number, number, number]; phase?: number }) {
  const ref = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.3 + phase) * 0.08;
  });
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 2.4, 4]} />
        <meshBasicMaterial color="#2a1a0c" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial color="#ff8a3d" emissive="#ff7a2a" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.1, 10]} />
        <meshStandardMaterial color="#3a2410" />
      </mesh>
      <Glow position={[0, 0, 0]} color="#ffb060" scale={2.2} opacity={0.6} />
    </group>
  );
}

function CanopyProps() {
  return (
    <group>
      {/* Great trunks framing the ring */}
      {[-12.5, 12.5].map((x) => (
        <mesh key={x} position={[x, 4, -3]}>
          <cylinderGeometry args={[0.9, 1.3, 10, 14]} />
          <meshStandardMaterial color="#4a2e18" roughness={0.95} />
        </mesh>
      ))}
      {/* Rope rail */}
      {[-2.8].map((z) => (
        <mesh key={z} position={[0, 1.1, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 26, 6]} />
          <meshStandardMaterial color="#c8a06a" />
        </mesh>
      ))}
      {[-10, -5, 0, 5, 10].map((x) => (
        <mesh key={x} position={[x, 0.55, -2.8]}>
          <cylinderGeometry args={[0.09, 0.11, 1.1, 8]} />
          <meshStandardMaterial color="#5a3a1e" />
        </mesh>
      ))}
      <Lantern position={[-7, 4.4, -2]} />
      <Lantern position={[-2.5, 5, -3.5]} phase={1} />
      <Lantern position={[3, 4.7, -2.6]} phase={2} />
      <Lantern position={[8, 4.3, -1.8]} phase={3} />
    </group>
  );
}

function PirateProps() {
  const waterGeo = React.useMemo(() => new THREE.PlaneGeometry(60, 14, 60, 14), []);
  React.useEffect(() => () => waterGeo.dispose(), [waterGeo]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = waterGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, Math.sin(x * 0.5 + t * 1.2) * 0.12 + Math.cos(y * 0.7 + t) * 0.1);
    }
    p.needsUpdate = true;
    waterGeo.computeVertexNormals();
  });
  return (
    <group>
      {/* Sea beyond the dock */}
      <mesh geometry={waterGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -12]}>
        <meshStandardMaterial color="#2a4a78" roughness={0.25} metalness={0.4} emissive="#3a2050" emissiveIntensity={0.3} />
      </mesh>
      {/* Barrels */}
      {([[-10, -1.5], [-11.2, -0.3], [10.5, -1.2]] as [number, number][]).map(([x, z], i) => (
        <group key={i} position={[x, 0.55, z]}>
          <mesh>
            <cylinderGeometry args={[0.5, 0.5, 1.1, 16]} />
            <meshStandardMaterial color="#7a4a24" roughness={0.8} />
          </mesh>
          {[-0.35, 0.35].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.51, 0.035, 6, 20]} />
              <meshStandardMaterial color="#2b2b2b" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Mooring posts + rope */}
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 0.6, -2.7]}>
          <cylinderGeometry args={[0.16, 0.2, 1.2, 10]} />
          <meshStandardMaterial color="#5a3a1e" />
        </mesh>
      ))}
      <mesh position={[0, 1.0, -2.7]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 22, 6]} />
        <meshStandardMaterial color="#d8b27a" />
      </mesh>
      {/* Mast */}
      <mesh position={[11.5, 5, -4]}>
        <cylinderGeometry args={[0.18, 0.25, 12, 10]} />
        <meshStandardMaterial color="#4a2e18" />
      </mesh>
      <Lantern position={[-8, 3.8, -2.5]} />
      <Lantern position={[7.5, 4, -2.2]} phase={2} />
    </group>
  );
}

function Torch({ position }: { position: [number, number, number] }) {
  const flame = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + position[0];
    if (flame.current) flame.current.scale.set(1, 1 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7) * 0.1, 1);
  });
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.08, 0.05, 0.9, 8]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>
      <mesh ref={flame} position={[0, 0.6, 0]}>
        <coneGeometry args={[0.16, 0.45, 10]} />
        <meshBasicMaterial color="#ffb13b" toneMapped={false} />
      </mesh>
      <Glow position={[0, 0.6, 0]} color="#ff9a3b" scale={2} opacity={0.75} />
    </group>
  );
}

function TempleProps() {
  return (
    <group>
      {[-11.5, -7.5, 7.5, 11.5].map((x, i) => (
        <group key={x} position={[x, 0, -3.2 - (i % 2) * 1.2]}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[1.5, 0.5, 1.5]} />
            <meshStandardMaterial color="#6b6857" roughness={0.95} />
          </mesh>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.55, 0.62, 5, 12]} />
            <meshStandardMaterial color="#8a866f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 5.7, 0]}>
            <boxGeometry args={[1.6, 0.45, 1.6]} />
            <meshStandardMaterial color="#6b6857" roughness={0.95} />
          </mesh>
          {/* Vines */}
          <mesh position={[0.3, 3.4, 0.58]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.12, 3.5, 0.05]} />
            <meshStandardMaterial color="#3f7a2e" />
          </mesh>
        </group>
      ))}
      <Torch position={[-5, 0.45, -2.6]} />
      <Torch position={[5, 0.45, -2.6]} />
    </group>
  );
}

function Gear({ position, radius, speed, color }: { position: [number, number, number]; radius: number; speed: number; color: string }) {
  const ref = React.useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  const teeth = Math.round(radius * 10);
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.3, 32]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.16]}>
        <cylinderGeometry args={[radius * 0.3, radius * 0.3, 0.05, 16]} />
        <meshStandardMaterial color="#222" metalness={0.5} />
      </mesh>
      {Array.from({ length: teeth }, (_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]} rotation={[0, 0, a]}>
            <boxGeometry args={[0.35, 0.22, 0.28]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function FactoryProps() {
  const belt = React.useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!belt.current) return;
    belt.current.children.forEach((c) => {
      c.position.x += dt * 1.5;
      if (c.position.x > 13) c.position.x -= 26;
    });
  });
  return (
    <group>
      <Gear position={[-10.5, 4.2, -4]} radius={1.6} speed={0.6} color="#d4a017" />
      <Gear position={[-8.3, 5.6, -4.3]} radius={0.9} speed={-1.05} color="#b0b6c0" />
      <Gear position={[10.8, 3.6, -4]} radius={1.3} speed={-0.8} color="#b0b6c0" />
      {/* Conveyor behind the ring, carrying emoji "blanks" */}
      <mesh position={[0, 0.55, -3.3]}>
        <boxGeometry args={[28, 0.2, 1]} />
        <meshStandardMaterial color="#26282e" metalness={0.4} roughness={0.6} />
      </mesh>
      <group ref={belt} position={[0, 0.9, -3.3]}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-13 + i * 3, 0, 0]}>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshStandardMaterial color="#ffcc33" emissive="#ffaa00" emissiveIntensity={0.35} />
          </mesh>
        ))}
      </group>
      {/* Pipes */}
      {[-12.5, 12.5].map((x) => (
        <mesh key={x} position={[x, 3.5, -2.5]}>
          <cylinderGeometry args={[0.35, 0.35, 8, 14]} />
          <meshStandardMaterial color="#8f949c" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <Glow position={[-10.5, 4.2, -3.6]} color="#ffcf3f" scale={2} opacity={0.35} />
    </group>
  );
}

function NeonTube({ position, color, length = 3, vertical = false }: { position: [number, number, number]; color: string; length?: number; vertical?: boolean }) {
  const ref = React.useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    // The occasional flicker, like a tired neon sign.
    const t = clock.elapsedTime + position[0] * 3;
    if (ref.current) ref.current.opacity = Math.sin(t * 23) > 0.97 ? 0.35 : 1;
  });
  return (
    <group position={position} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, length, 8]} />
        <meshBasicMaterial ref={ref} color={color} transparent toneMapped={false} />
      </mesh>
      <sprite scale={[length * 1.4, 1.1, 1]}>
        <spriteMaterial map={glowTexture()} color={color} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

function SubwayProps() {
  return (
    <group>
      {[-11, -5.5, 5.5, 11].map((x) => (
        <mesh key={x} position={[x, 3, -3.4]}>
          <boxGeometry args={[0.7, 6, 0.7]} />
          <meshStandardMaterial color="#3a3350" roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
      <NeonTube position={[-8.2, 4.6, -3.2]} color="#ff3fd0" length={3.6} />
      <NeonTube position={[8.2, 4.6, -3.2]} color="#3fe8ff" length={3.6} />
      <NeonTube position={[0, 5.6, -4.2]} color="#ffe14d" length={5} />
      <NeonTube position={[-12.2, 2.5, -2.5]} color="#3fe8ff" length={2.5} vertical />
      <NeonTube position={[12.2, 2.5, -2.5]} color="#ff3fd0" length={2.5} vertical />
      {/* Rails in the trackbed behind the platform */}
      {[-4.6, -5.4].map((z) => (
        <mesh key={z} position={[0, -0.35, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 40, 6]} />
          <meshStandardMaterial color="#9aa0b0" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

const PROPS: Record<Props, () => React.ReactElement> = {
  canopy: CanopyProps,
  pirate: PirateProps,
  temple: TempleProps,
  factory: FactoryProps,
  subway: SubwayProps,
};

export function Stage3D({ stage }: { stage: Stage }) {
  const theme = themeOf(stage.id);
  const StageProps = PROPS[theme.props];
  return (
    <group>
      <color attach="background" args={[theme.fog]} />
      <fog attach="fog" args={[theme.fog, 22, 70]} />
      <hemisphereLight args={[theme.sky, theme.ground, 1.1]} />
      <directionalLight position={[4, 9, 7]} intensity={1.5} color={theme.key} />
      <directionalLight position={[-6, 4, -6]} intensity={1.3} color={theme.rim} />
      <ambientLight intensity={0.25} />
      <React.Suspense fallback={null}>
        <Backdrop url={stage.background} paintedFloor={theme.paintedFloor} />
      </React.Suspense>
      <Floor theme={theme} />
      <StageProps />
      <Motes color={theme.motes} />
    </group>
  );
}
