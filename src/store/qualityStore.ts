import { create } from 'zustand';

// A safety net for slower phones: every 3D canvas watches its own frame rate
// and, if the device can't keep up, steps the rendering quality down.
//
//   level 0  full quality (pixel ratio up to 1.75)
//   level 1  pixel ratio 1.25
//   level 2  pixel ratio 1.0, decorative extras off (ambient motes, half the
//            title-screen emoji rain)
//   level 3  pixel ratio 0.8 — last resort
//
// The level is shared across canvases for the visit (so the next screen
// starts where the last one settled) and only ever steps down: flipping
// quality back and forth would look worse than holding a lower level.

export const QUALITY_DPR = [1.75, 1.25, 1, 0.8];
export const MAX_LEVEL = QUALITY_DPR.length - 1;

interface QualityState {
  level: number;
  degrade: () => void;
}

export const useQuality = create<QualityState>((set) => ({
  level: 0,
  degrade: () => set((s) => ({ level: Math.min(MAX_LEVEL, s.level + 1) })),
}));

// Pixel ratio for a level, never above what the screen actually has.
export const dprFor = (level: number) =>
  Math.min(QUALITY_DPR[level], typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

// The starting pixel ratio for a new canvas.
export const initialDpr = () => dprFor(useQuality.getState().level);
