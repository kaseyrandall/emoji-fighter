import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { emojiTexture, glowTexture, textTexture } from './textures';
import { SpecialStyle } from './specialStyles';

// Pooled hit effects: additive spark particles, emoji particles, expanding
// shockwave rings and floating damage numbers. Pools are allocated once, so a flurry of hits never
// allocates GPU resources mid-fight.

export interface VfxApi {
  burst: (pos: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed?: number) => void;
  ring: (pos: THREE.Vector3, color: THREE.ColorRepresentation, maxScale?: number, dur?: number, flat?: boolean) => void;
  // A character's special: `from` is the caster's chest, `dir` the way they
  // face, `target` where the blow lands.
  special: (style: SpecialStyle, from: THREE.Vector3, dir: number, target: THREE.Vector3) => void;
  number: (pos: THREE.Vector3, text: string, fill: string) => void;
  clear: () => void;
}

const MAX_PARTICLES = 360;
const MAX_RINGS = 6;
const MAX_NUMBERS = 4;
const MAX_GLYPHS = 56;
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

  // --- emoji particles ---
  const glyphs = React.useMemo(
    () =>
      Array.from({ length: MAX_GLYPHS }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        s.visible = false;
        return { sprite: s, vel: new THREE.Vector3(), life: 0, max: 1, grav: 0, size: 0.6, spin: 0 };
      }),
    []
  );
  const glyphNext = React.useRef(0);
  // Timed emitters for streams / rains / eruptions (spawn a few per frame).
  const emitters = React.useRef<{ t: number; dur: number; rate: number; acc: number; spawn: () => void }[]>([]);

  const spawnGlyph = React.useCallback(
    (emoji: string, pos: THREE.Vector3, vel: THREE.Vector3, life: number, grav: number, size: number) => {
      const g = glyphs[glyphNext.current];
      glyphNext.current = (glyphNext.current + 1) % MAX_GLYPHS;
      const m = g.sprite.material;
      // Textures are cached per emoji and shared: never dispose them here.
      if (m.map !== emojiTexture(emoji)) {
        m.map = emojiTexture(emoji);
        m.needsUpdate = true;
      }
      g.sprite.position.copy(pos);
      g.vel.copy(vel);
      g.life = g.max = life;
      g.grav = grav;
      g.size = size;
      g.spin = (Math.random() - 0.5) * 6;
      m.rotation = Math.random() * Math.PI * 2;
      g.sprite.visible = true;
    },
    [glyphs]
  );

  React.useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
      rings.forEach((r) => (r.mesh.material as THREE.Material).dispose());
      numbers.forEach((n) => {
        n.sprite.material.map?.dispose();
        n.sprite.material.dispose();
      });
      glyphs.forEach((g) => g.sprite.material.dispose());
    },
    [points, rings, numbers, glyphs]
  );

  React.useImperativeHandle(ref, () => {
    const api: VfxApi = {
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
      ring(pos, color, max = 3, dur = 0.5, flat = false) {
        const r = rings[ringNext.current];
        ringNext.current = (ringNext.current + 1) % MAX_RINGS;
        r.mesh.position.copy(pos);
        r.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
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
      special(style, from, dir, target) {
        const pick = () => style.glyphs[Math.floor(Math.random() * style.glyphs.length)];
        const grav = style.gravity ?? -5;
        const p = new THREE.Vector3();
        const v = new THREE.Vector3();
        const origin = from.clone();
        const dest = target.clone();
        const addEmitter = (dur: number, rate: number, spawn: () => void) =>
          emitters.current.push({ t: 0, dur, rate, acc: 0, spawn });

        if (style.mode === 'stream') {
          // Breath / beam pouring forward out of the caster.
          const reach = Math.max(2.5, Math.abs(dest.x - origin.x) + 1);
          addEmitter(0.42, 45, () => {
            p.set(origin.x + dir * 0.7, origin.y + (Math.random() - 0.5) * 0.3, origin.z + 0.2);
            const speed = reach / 0.5;
            v.set(dir * speed * (0.8 + Math.random() * 0.4), (Math.random() - 0.4) * 1.6, (Math.random() - 0.5) * 1.2);
            spawnGlyph(pick(), p, v, 0.55, grav * 0.2, 0.55);
            if (Math.random() < 0.6) api.burst(p, style.color, 2, 3);
          });
        } else if (style.mode === 'burst') {
          // Explosion on the target.
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
            const sp = 3 + Math.random() * 3;
            v.set(Math.cos(a) * sp, Math.sin(a) * sp + 1.5, (Math.random() - 0.5) * 2);
            spawnGlyph(pick(), dest, v, 0.75 + Math.random() * 0.3, grav, 0.6);
          }
          api.burst(dest, style.color, 50, 8);
          api.ring(dest, style.color, 2.6, 0.45);
        } else if (style.mode === 'rain') {
          // Pelting down onto the target from above.
          addEmitter(0.55, 30, () => {
            p.set(dest.x + (Math.random() - 0.5) * 2.2, dest.y + 3, dest.z + (Math.random() - 0.5) * 0.8);
            v.set((Math.random() - 0.5) * 0.6, -5 - Math.random() * 2, 0);
            spawnGlyph(pick(), p, v, 0.7, -6, 0.7);
          });
          api.burst(dest, style.color, 30, 6);
        } else {
          // Erupting up out of the floor under the target.
          addEmitter(0.5, 36, () => {
            p.set(dest.x + (Math.random() - 0.5) * 2, 0.15, dest.z + (Math.random() - 0.5) * 1);
            v.set((Math.random() - 0.5) * 1, 4.5 + Math.random() * 3.5, 0);
            spawnGlyph(pick(), p, v, 0.65, -3, 0.65);
            if (Math.random() < 0.5) api.burst(p, style.color, 2, 3);
          });
        }
        if (style.floorRing) {
          p.set(dest.x, 0.05, dest.z);
          api.ring(p, style.color, 4, 0.6, true);
        }
      },
      clear() {
        emitters.current = [];
        glyphs.forEach((g) => (g.sprite.visible = false));
        parts.current.life.fill(0);
        rings.forEach((r) => (r.mesh.visible = false));
        numbers.forEach((n) => (n.sprite.visible = false));
      },
    };
    return api;
  }, [points, rings, numbers, glyphs, spawnGlyph]);

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

    // Emitters spawn at a fixed rate for their duration.
    if (emitters.current.length) {
      for (const e of emitters.current) {
        e.t += dt;
        e.acc += dt * e.rate;
        while (e.acc >= 1) {
          e.acc -= 1;
          e.spawn();
        }
      }
      emitters.current = emitters.current.filter((e) => e.t < e.dur);
    }

    for (const g of glyphs) {
      if (!g.sprite.visible) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.sprite.visible = false;
        continue;
      }
      g.vel.y += g.grav * dt;
      g.vel.multiplyScalar(Math.exp(-1.2 * dt));
      g.sprite.position.addScaledVector(g.vel, dt);
      const age = 1 - g.life / g.max;
      // Pop in, then shrink and fade out over the last third of its life.
      const grow = Math.min(1, age * 7);
      const k = g.life / g.max;
      g.sprite.scale.setScalar(g.size * (0.4 + 0.8 * grow) * (k < 0.33 ? 0.6 + k * 1.2 : 1));
      g.sprite.material.opacity = k < 0.33 ? k / 0.33 : 1;
      g.sprite.material.rotation += g.spin * dt;
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
      {glyphs.map((g, i) => (
        <primitive key={`g${i}`} object={g.sprite} />
      ))}
      {numbers.map((n, i) => (
        <primitive key={`n${i}`} object={n.sprite} />
      ))}
    </group>
  );
});
