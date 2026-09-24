import { AttackMove } from '../types/game';

// Everything a fighter rig needs to know about "its" fighter on a given frame.
// Scenes build this from wherever their state lives (the game store in the
// arena, a scripted demo on the menus) — the rig itself is presentation only.
export interface FighterInput {
  x: number;
  y: number; // height above the floor, world units
  facing: 1 | -1; // +1 faces +X (screen right)
  vel: number; // horizontal speed, for leaning into a run
  attackSeq: number; // bumps once per attack thrown
  attackMove: AttackMove | null;
  hitSeq: number; // bumps once per hit taken
  hitMove: AttackMove | null;
  pose: 'fight' | 'ko' | 'win';
  charged: boolean; // super meter full: pulsing aura
}

export const defaultFighterInput = (x = 0, facing: 1 | -1 = 1): FighterInput => ({
  x, y: 0, facing, vel: 0, attackSeq: 0, attackMove: null, hitSeq: 0, hitMove: null, pose: 'fight', charged: false,
});
