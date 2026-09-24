import * as THREE from 'three';

// Canvas-generated textures shared across every 3D scene. Each is built once and
// cached, so re-mounting a scene (new round, new page) never re-rasterises.

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const EMOJI_RES = 256;

const emojiCache = new Map<string, THREE.CanvasTexture>();

// An emoji rasterised onto a transparent square canvas. Used as the alpha-tested
// "cookie cutter" that the fighters' layered bodies are stamped from.
export function emojiTexture(emoji: string): THREE.CanvasTexture {
  const cached = emojiCache.get(emoji);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = EMOJI_RES;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(EMOJI_RES * 0.8)}px ${EMOJI_FONT}`;
  // Nudge down a touch: emoji glyphs sit high in their em box.
  ctx.fillText(emoji, EMOJI_RES / 2, EMOJI_RES * 0.54);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  emojiCache.set(emoji, tex);
  return tex;
}

let glowTex: THREE.CanvasTexture | undefined;

// Soft white radial falloff: particles, halos, and light pools.
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(canvas);
  return glowTex;
}

let shadowTex: THREE.CanvasTexture | undefined;

// Dark radial blob — a cheap contact shadow under each fighter (no shadow maps,
// which are too heavy for the phones this game mostly runs on).
export function shadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  shadowTex = new THREE.CanvasTexture(canvas);
  return shadowTex;
}

export type FloorPattern = 'planks' | 'stone' | 'hazard' | 'tiles' | 'deck';

const floorCache = new Map<string, THREE.CanvasTexture>();

// Procedural floor surfaces, one per stage theme.
export function floorTexture(pattern: FloorPattern, base: string, line: string): THREE.CanvasTexture {
  const key = `${pattern}|${base}|${line}`;
  const cached = floorCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random so the floor looks the same every visit.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  ctx.strokeStyle = line;
  if (pattern === 'planks' || pattern === 'deck') {
    const rows = pattern === 'deck' ? 8 : 6;
    const h = size / rows;
    for (let r = 0; r < rows; r++) {
      // Per-plank tone variation.
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.18})`;
      ctx.fillRect(0, r * h, size, h);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, r * h);
      ctx.lineTo(size, r * h);
      ctx.stroke();
      // Butt joints, staggered.
      const off = rand() * size;
      ctx.lineWidth = 3;
      for (let x = off % 170; x < size; x += 170) {
        ctx.beginPath();
        ctx.moveTo(x, r * h);
        ctx.lineTo(x, (r + 1) * h);
        ctx.stroke();
      }
      // Grain.
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      for (let g = 0; g < 4; g++) {
        const y = r * h + rand() * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + 4, size * 0.6, y - 4, size, y);
        ctx.stroke();
      }
      ctx.strokeStyle = line;
    }
  } else if (pattern === 'stone') {
    const cell = size / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rand() * 0.1})`;
        const ox = r % 2 ? cell / 2 : 0;
        ctx.fillRect(c * cell + ox, r * cell, cell, cell);
        ctx.lineWidth = 6;
        ctx.strokeRect(c * cell + ox, r * cell, cell, cell);
        ctx.strokeRect(c * cell + ox - size, r * cell, cell, cell);
      }
    }
    // Moss flecks.
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(90,140,60,${0.15 + rand() * 0.25})`;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, 2 + rand() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'hazard') {
    // Riveted metal plates with a hazard-striped border.
    const cell = size / 2;
    ctx.lineWidth = 5;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      ctx.strokeRect(c * cell, r * cell, cell, cell);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (const [dx, dy] of [[14, 14], [cell - 14, 14], [14, cell - 14], [cell - 14, cell - 14]]) {
        ctx.beginPath();
        ctx.arc(c * cell + dx, r * cell + dy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Diamond tread.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3;
    for (let y = 0; y < size; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < size; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + 10, y - 2);
      ctx.stroke();
    }
  } else if (pattern === 'tiles') {
    const cell = size / 8;
    ctx.lineWidth = 3;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + rand() * 0.06})`;
      ctx.fillRect(c * cell, r * cell, cell, cell);
      ctx.strokeRect(c * cell, r * cell, cell, cell);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  floorCache.set(key, tex);
  return tex;
}

// A short string (damage numbers) drawn in the arcade font with a heavy outline.
export function textTexture(text: string, fill: string, stroke = '#000'): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `64px "Press Start 2P", monospace`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, w / 2, h / 2 + 4);
  ctx.fillStyle = fill;
  ctx.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
