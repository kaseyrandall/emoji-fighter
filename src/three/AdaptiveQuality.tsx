import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useQuality, dprFor, MAX_LEVEL } from '../store/qualityStore';

// Watches this canvas's frame rate and steps the shared quality level down
// when the device can't keep up (see store/qualityStore.ts).
const WARMUP_S = 2.5; // ignore start-up hitches (texture uploads, shader compiles)
const WINDOW_S = 2; // measure the frame rate over windows this long
const MIN_FPS = 45; // below this for two windows in a row → step down
const SETTLE_S = 2; // after a step, give the new level time before judging it

export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const level = useQuality((s) => s.level);
  const m = React.useRef({ frames: 0, window: 0, bad: 0, settle: WARMUP_S });

  // Apply the current level's pixel ratio (also when another canvas lowered it).
  React.useEffect(() => {
    setDpr(dprFor(level));
    m.current.settle = SETTLE_S;
    m.current.bad = 0;
  }, [level, setDpr]);

  useFrame((_, dt) => {
    const s = m.current;
    // A hidden tab or a long stall isn't the device being slow.
    if (dt > 0.5 || document.hidden) return;
    if (s.settle > 0) {
      s.settle -= dt;
      return;
    }
    s.window += dt;
    s.frames++;
    if (s.window < WINDOW_S) return;
    const fps = s.frames / s.window;
    s.window = 0;
    s.frames = 0;
    s.bad = fps < MIN_FPS ? s.bad + 1 : 0;
    if (s.bad >= 2 && useQuality.getState().level < MAX_LEVEL) {
      s.bad = 0;
      useQuality.getState().degrade();
    }
  });
  return null;
}
