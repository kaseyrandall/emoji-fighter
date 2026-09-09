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
  gameStatus: 'ready' | 'playing' | 'paused' | 'won' | 'lost';
  round: number;
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