import * as THREE from 'three';

// Canvas-generated textures shared across every 3D scene. Each is built once and
// cached, so re-mounting a scene (new round, new page) never re-rasterises.

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const EMOJI_RES = 256;

const emojiCache = new Map<string, { tex: THREE.CanvasTexture; facesRight: boolean }>();

// Emoji art differs a lot between platforms (Apple on iPhone / iPad / Mac,
// Google Noto on Android, Segoe on Windows): glyphs sit at different sizes
// and heights in their box, and some animals face the other way. So every
// emoji is measured after drawing and re-fitted: scaled to the same size,
// centred, and standing on the bottom edge (a fighter's feet on the floor).

// The opaque bounds of a canvas's pixels, or null if it's blank.
function opaqueBounds(data: Uint8ClampedArray, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Apple devices (iPhone, iPad, Mac — in any browser) draw emoji with Apple's
// set; everything else here assumes Google's Noto-style art (Android, Chrome
// OS), whose side-on animals all face left like the rig does. (iPadOS's
// desktop-mode Safari reports itself as a Mac, which is still Apple art.)
const APPLE_EMOJI = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(navigator.userAgent);

// Side-on emoji that Apple draws facing right (checked against Apple's art):
// these get mirrored on Apple devices so they face their opponent.
const APPLE_FACES_RIGHT = new Set(['🦖', '🦄']);

function buildEmoji(emoji: string) {
  // Draw big on a scratch canvas, find the glyph's real bounds…
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = EMOJI_RES * 1.5;
  const sctx = scratch.getContext('2d', { willReadFrequently: true })!;
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.font = `${Math.round(EMOJI_RES * 0.9)}px ${EMOJI_FONT}`;
  sctx.fillText(emoji, scratch.width / 2, scratch.height / 2);
  const box = opaqueBounds(sctx.getImageData(0, 0, scratch.width, scratch.height).data, scratch.width, scratch.height);

  // …then fit it: 92% of the box on its longer side, centred horizontally,
  // standing on the bottom edge.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = EMOJI_RES;
  const ctx = canvas.getContext('2d')!;
  if (box) {
    const scale = (EMOJI_RES * 0.92) / Math.max(box.w, box.h);
    const dw = box.w * scale;
    const dh = box.h * scale;
    ctx.drawImage(scratch, box.x, box.y, box.w, box.h, (EMOJI_RES - dw) / 2, EMOJI_RES * 0.98 - dh, dw, dh);
  }
  const facesRight = APPLE_EMOJI && APPLE_FACES_RIGHT.has(emoji);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const entry = { tex, facesRight };
  emojiCache.set(emoji, entry);
  return entry;
}

// An emoji rasterised onto a transparent square canvas (normalised as above).
// Used as the alpha-tested "cookie cutter" that the 3D bodies are stamped from.
export function emojiTexture(emoji: string): THREE.CanvasTexture {
  return (emojiCache.get(emoji) ?? buildEmoji(emoji)).tex;
}

// Whether this device draws the emoji looking to the right. Fighters face
// left in their own art space, so a right-facing glyph gets mirrored.
export function emojiFacesRight(emoji: string): boolean {
  return (emojiCache.get(emoji) ?? buildEmoji(emoji)).facesRight;
}

// A rounded-rectangle path with per-corner radii [tl, tr, br, bl]. (The
// built-in ctx.roundRect is missing on older Safari / iPadOS.)
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, [tl, tr, br, bl]: number[]) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

let gloveTex: THREE.CanvasTexture | undefined;

// A boxing glove drawn in the emoji style. Platforms draw 🥊 at very
// different angles (Google upright, Apple lying on its side), so the gloves
// use this instead: upright, knuckles at the top, thumb on the right (toward
// the body in the rig), cuff at the bottom — identical on every device.
export function gloveTexture(): THREE.CanvasTexture {
  if (gloveTex) return gloveTex;
  const R = EMOJI_RES;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = R;
  const ctx = canvas.getContext('2d')!;
  const outline = '#5c0710';
  ctx.lineJoin = 'round';

  const red = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#ff5a5f');
    g.addColorStop(0.55, '#e0202b');
    g.addColorStop(1, '#a90f1c');
    return g;
  };

  // Cuff.
  roundedRect(ctx, 78, 168, 104, 70, [14, 14, 14, 14]);
  ctx.fillStyle = red(78, 168, 182, 238);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // Cuff band.
  ctx.fillStyle = '#ffd23f';
  roundedRect(ctx, 98, 192, 64, 20, [8, 8, 8, 8]);
  ctx.fill();

  // Thumb (right side), drawn before the fist so the fist overlaps its root.
  ctx.beginPath();
  ctx.ellipse(186, 118, 30, 46, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = red(160, 70, 216, 170);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.stroke();

  // Fist.
  roundedRect(ctx, 52, 18, 148, 162, [70, 70, 34, 34]);
  ctx.fillStyle = red(52, 18, 200, 180);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.stroke();

  // Knuckle crease and the seam where the thumb tucks in.
  ctx.strokeStyle = 'rgba(92,7,16,0.55)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(78, 70);
  ctx.quadraticCurveTo(126, 58, 176, 72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(182, 92);
  ctx.quadraticCurveTo(172, 124, 184, 150);
  ctx.stroke();

  // Glossy highlight.
  const hl = ctx.createRadialGradient(96, 56, 4, 96, 56, 46);
  hl.addColorStop(0, 'rgba(255,255,255,0.75)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.ellipse(96, 60, 40, 30, -0.5, 0, Math.PI * 2);
  ctx.fill();

  gloveTex = new THREE.CanvasTexture(canvas);
  gloveTex.colorSpace = THREE.SRGBColorSpace;
  gloveTex.anisotropy = 4;
  return gloveTex;
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
  // Shrink longer callouts ("BLOCK", "DODGE") to fit the canvas.
  ctx.font = `64px "Press Start 2P", monospace`;
  const fit = Math.min(1, (w - 24) / Math.max(1, ctx.measureText(text).width));
  if (fit < 1) ctx.font = `${Math.floor(64 * fit)}px "Press Start 2P", monospace`;
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
