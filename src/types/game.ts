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
    kick: number;
    special: number;
  };
  specialName: string;
}

export interface GameState {
  selectedCharacter: Character | null;
  opponent: Character | null;
  playerHealth: number;
  opponentHealth: number;
  gameStatus: 'intro' | 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'champion';
  round: number;
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

export interface HitEvent {
  target: 'player' | 'opponent';
  amount: number;
  move: Move | null;
  seq: number;
}

export type Move = 'punch' | 'kick' | 'special' | 'left' | 'right' | 'jump';

export interface Stage {
  id: string;
  name: string;
  background: string;
  description: string;
  floorColor: string;
  ambientLight: string;
}