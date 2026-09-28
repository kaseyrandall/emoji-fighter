import { create } from 'zustand';

// The film's clock. Everything on screen is a function of `t` (seconds), so a
// frame can be rendered at any exact time, in order, as slowly as needed.
// `take` bumps whenever time runs backwards (the preview looping, a re-render
// from the top): the scene remounts fresh, since the rigs and effects carry
// state from frame to frame and can't play in reverse.
export const useCine = create<{ t: number; take: number }>(() => ({ t: 0, take: 0 }));
export const now = () => useCine.getState().t;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// Progress (0..1) of `t` through the window [a, b].
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const easeInQuad = (k: number) => k * k;
export const easeInCubic = (k: number) => k * k * k;
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOutBack = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

// Seeded random, so every render of the film is identical.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// True on the frame where the clock first passes `at`.
export const crossed = (prev: number, t: number, at: number) => prev < at && t >= at;
