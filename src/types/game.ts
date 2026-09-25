export interface Character {
  id: string;
  name: string;
  emoji: string;
  health: number;
  description: string;
  stats: {
    power: number;
    speed: number;
    technique: number;
  };
  moves: {
    punch: number;
    heavy: number; // uppercut: slower recovery, more damage
    special: number;
  };
  specialName: string;
}

export interface GameState {
  selectedCharacter: Character | null;
  opponent: Character | null;
  playerHealth: number;
  opponentHealth: number;
  gameStatus: 'intro' | 'ready' | 'playing' | 'paused' | 'roundEnd' | 'won' | 'lost' | 'champion';
  round: number;
  // During the 'roundEnd' KO beat: which fighter was just knocked out.
  roundLoser: 'player' | 'opponent' | null;
  // Gauntlet ladder: ordered opponents the player faces, easiest first.
  gauntletOpponents: Character[];
  gauntletStage: number;
  playerPosition: number;
  playerY: number;
  opponentPosition: number;
  opponentY: number;
  isAttacking: boolean;
  currentMove: Move | null;
  currentStage: string;
  countdown: number;
  timer: number;
  playerWins: number;
  opponentWins: number;
  isJumping: boolean;
  hitEvent: HitEvent | null;
  // Which way the player emoji faces — follows the last horizontal input.
  playerFacing: 'left' | 'right';
}

// How an attack in range resolved: it landed, was guarded (chip damage), or
// whiffed because the target was out of its vertical reach (a jump dodge).
export type HitResult = 'hit' | 'blocked' | 'dodged';

export interface HitEvent {
  target: 'player' | 'opponent';
  amount: number;
  move: Move | null;
  seq: number;
  result: HitResult;
}

export type AttackMove = 'punch' | 'heavy' | 'special';
export type Move = AttackMove | 'left' | 'right' | 'jump';

export interface Stage {
  id: string;
  name: string;
  background: string;
  description: string;
  floorColor: string;
  ambientLight: string;
}