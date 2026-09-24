import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { glowTexture, textTexture } from './textures';

// Pooled hit effects: additive spark particles, expanding shockwave rings and
// floating damage numbers. Pools are allocated once, so a flurry of hits never
// allocates GPU resources mid-fight.

export interface VfxApi {
  burst: (pos: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed?: number) => void;
  ring: (pos: THREE.Vector3, color: THREE.ColorRepresentation, maxScale?: number, dur?: number) => void;
  number: (pos: THREE.Vector3, text: string, fill: string) => void;
  clear: () => void;
}

const MAX_PARTICLES = 360;
const MAX_RINGS = 6;
const MAX_NUMBERS = 4;
const GRAVITY = -9;

const ringGeo = new THREE.RingGeometry(0.82, 1, 48);

export const Vfx = React.forwardRef<VfxApi>(function Vfx(_, ref) {
  // --- sparks ---
  const points = React.useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_PARTICLES * 3).fill(-999);
    const col = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const obj = new THREE.Points(geo, mat);
    obj.frustumCulled = false;
    return obj;
  }, []);
  const parts = React.useRef({
    vel: new Float32Array(MAX_PARTICLES * 3),
    life: new Float32Array(MAX_PARTICLES),
    max: new Float32Array(MAX_PARTICLES).fill(1),
    base: new Float32Array(MAX_PARTICLES * 3),
    next: 0,
  });

  // --- rings ---
  const rings = React.useMemo(
    () =>
      Array.from({ length: MAX_RINGS }, () => {
        const m = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        );
        m.visible = false;
        return { mesh: m, t: 0, dur: 0.5, max: 3 };
      }),
    []
  );
  const ringNext = React.useRef(0);

  // --- damage numbers ---
  const numbers = React.useMemo(
    () =>
      Array.from({ length: MAX_NUMBERS }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
        s.visible = false;
        s.renderOrder = 10;
        return { sprite: s, t: 0 };
      }),
    []
  );
  const numNext = React.useRef(0);

  React.useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
      rings.forEach((r) => (r.mesh.material as THREE.Material).dispose());
      numbers.forEach((n) => {
        n.sprite.material.map?.dispose();
        n.sprite.material.dispose();
      });
    },
    [points, rings, numbers]
  );

  React.useImperativeHandle(ref, () => ({
    burst(pos, color, count, speed = 6) {
      const p = parts.current;
      const c = new THREE.Color(color);
      const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
      for (let n = 0; n < count; n++) {
        const i = p.next;
        p.next = (p.next + 1) % MAX_PARTICLES;
        // Random direction, biased outward in the screen plane (it reads best).
        const th = Math.random() * Math.PI * 2;
        const ph = (Math.random() - 0.5) * 1.2;
        const sp = speed * (0.35 + Math.random() * 0.75);
        p.vel[i * 3] = Math.cos(th) * Math.cos(ph) * sp;
        p.vel[i * 3 + 1] = Math.sin(th) * Math.cos(ph) * sp + speed * 0.25;
        p.vel[i * 3 + 2] = Math.sin(ph) * sp;
        posAttr.setXYZ(i, pos.x, pos.y, pos.z);
        const life = 0.35 + Math.random() * 0.4;
        p.life[i] = life;
        p.max[i] = life;
        // Slight hue jitter so bursts sparkle rather than look flat.
        const j = 0.8 + Math.random() * 0.4;
        p.base[i * 3] = Math.min(1, c.r * j);
        p.base[i * 3 + 1] = Math.min(1, c.g * j);
        p.base[i * 3 + 2] = Math.min(1, c.b * j);
      }
    },
    ring(pos, color, max = 3, dur = 0.5) {
      const r = rings[ringNext.current];
      ringNext.current = (ringNext.current + 1) % MAX_RINGS;
      r.mesh.position.copy(pos);
      (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      r.t = 0;
      r.dur = dur;
      r.max = max;
      r.mesh.visible = true;
    },
    number(pos, text, fill) {
      const n = numbers[numNext.current];
      numNext.current = (numNext.current + 1) % MAX_NUMBERS;
      n.sprite.material.map?.dispose();
      n.sprite.material.map = textTexture(text, fill);
      n.sprite.material.needsUpdate = true;
      n.sprite.position.copy(pos);
      n.t = 0;
      n.sprite.visible = true;
    },
    clear() {
      parts.current.life.fill(0);
      rings.forEach((r) => (r.mesh.visible = false));
      numbers.forEach((n) => (n.sprite.visible = false));
    },
  }), [points, rings, numbers]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const p = parts.current;
    const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = points.geometry.attributes.color as THREE.BufferAttribute;
    const pa = posAttr.array as Float32Array;
    const ca = colAttr.array as Float32Array;
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (p.life[i] <= 0) {
        if (ca[i * 3] !== 0 || ca[i * 3 + 1] !== 0 || ca[i * 3 + 2] !== 0) {
          ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = 0;
          any = true;
        }
        continue;
      }
      any = true;
      p.life[i] -= dt;
      p.vel[i * 3 + 1] += GRAVITY * dt;
      // Air drag.
      const drag = Math.exp(-2.5 * dt);
      p.vel[i * 3] *= drag;
      p.vel[i * 3 + 2] *= drag;
      pa[i * 3] += p.vel[i * 3] * dt;
      pa[i * 3 + 1] += p.vel[i * 3 + 1] * dt;
      pa[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      const k = Math.max(0, p.life[i] / p.max[i]);
      ca[i * 3] = p.base[i * 3] * k;
      ca[i * 3 + 1] = p.base[i * 3 + 1] * k;
      ca[i * 3 + 2] = p.base[i * 3 + 2] * k;
    }
    if (any) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    for (const r of rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const s = 0.2 + (1 - (1 - k) * (1 - k)) * r.max;
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      if (k >= 1) r.mesh.visible = false;
    }

    for (const n of numbers) {
      if (!n.sprite.visible) continue;
      n.t += dt;
      const k = n.t / 0.75;
      // Pop in, rise, fade.
      const pop = n.t < 0.12 ? 0.6 + (n.t / 0.12) * 0.7 : 1.3 - Math.min(0.3, (n.t - 0.12) * 1.5);
      n.sprite.scale.set(1.5 * pop, 0.75 * pop, 1);
      n.sprite.position.y += dt * 1.6;
      n.sprite.material.opacity = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4);
      if (k >= 1) n.sprite.visible = false;
    }
  });

  return (
    <group>
      <primitive object={points} />
      {rings.map((r, i) => (
        <primitive key={`r${i}`} object={r.mesh} />
      ))}
      {numbers.map((n, i) => (
        <primitive key={`n${i}`} object={n.sprite} />
      ))}
    </group>
  );
});
