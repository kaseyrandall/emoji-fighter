import { create } from 'zustand';
import { GameState, Character, Move } from '../types/game';
import { characters } from '../data/characters';
import { stages } from '../data/stages';

// Monotonic id so the UI re-triggers VFX even for identical damage values.
let hitSeq = 0;
const nextHit = () => ++hitSeq;

// How many opponents make up the gauntlet ladder (or all of them, if fewer).
export const GAUNTLET_SIZE = Math.min(6, characters.length - 1);

// AI timing state for the current round (reset when a round's AI loop starts).
let aiLastAttackAt = 0;
let aiEnteredRangeAt = 0;

// Difficulty ramps with the gauntlet stage: early fights are slow and gentle,
// later fights are fast, aggressive, and hit harder.
interface Difficulty {
  attackChance: number; // per-tick probability the AI throws a move while in range
  moveSpeed: number; // how fast the AI closes distance, per 50ms tick
  damageMult: number; // multiplier on the AI's move damage
  cooldownMs: number; // minimum gap between AI attacks
  reactionMs: number; // delay after entering range before the first attack
}

const difficultyForStage = (stage: number): Difficulty => ({
  attackChance: Math.min(0.14, 0.035 + stage * 0.02),
  moveSpeed: Math.min(4, 2 + stage * 0.35),
  damageMult: Math.min(1.3, 0.8 + stage * 0.09),
  cooldownMs: Math.max(320, 850 - stage * 90),
  reactionMs: Math.max(0, 500 - stage * 90),
});

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const randomStageId = () => stages[Math.floor(Math.random() * stages.length)].id;

// State shared by startGauntlet / advanceGauntlet when a fresh bout begins.
// Bouts open on the 'intro' VS screen; the arena starts the countdown after it.
const freshBout = () => ({
  gameStatus: 'intro' as const,
  round: 1,
  countdown: 3,
  timer: 99,
  playerWins: 0,
  opponentWins: 0,
  playerPosition: 15,
  playerY: 0,
  opponentPosition: 65,
  opponentY: 0,
  isJumping: false,
  isAttacking: false,
  isOpponentAttacking: false,
  currentMove: null,
  hitEvent: null,
});

interface GameStore extends GameState {
  selectCharacter: (character: Character) => void;
  selectOpponent: () => void;
  startGauntlet: (character: Character) => void;
  advanceGauntlet: () => void;
  performMove: (move: Move) => void;
  endRound: (winner: 'player' | 'opponent') => void;
  resetGame: () => void;
  togglePause: () => void;
  playerPosition: number;
  opponentPosition: number;
  isAttacking: boolean;
  isOpponentAttacking: boolean;
  setAttacking: (value: boolean) => void;
  startCountdown: () => void;
  opponentAttack: () => void;
  opponentAI: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  selectedCharacter: null,
  opponent: null,
  playerHealth: 100,
  opponentHealth: 100,
  gameStatus: 'ready',
  round: 1,
  gauntletOpponents: [],
  gauntletStage: 0,
  playerPosition: 15,
  playerY: 0,
  opponentPosition: 65,
  opponentY: 0,
  isAttacking: false,
  isOpponentAttacking: false,
  currentMove: null,
  currentStage: 'night-market',
  countdown: 3,
  timer: 99,
  playerWins: 0,
  opponentWins: 0,
  isJumping: false,
  hitEvent: null,
  setAttacking: (value) => set({ isAttacking: value }),

  selectCharacter: (character) => set({ selectedCharacter: character }),

  selectOpponent: () => {
    const availableOpponents = characters.filter(
      (char) => char.id !== (useGameStore.getState().selectedCharacter?.id)
    );
    const randomOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
    set({ opponent: randomOpponent, currentStage: randomStageId() });
  },

  // Build the ladder of opponents and start the first bout.
  startGauntlet: (character) => {
    const pool = characters.filter((c) => c.id !== character.id);
    const ladder = shuffle(pool).slice(0, GAUNTLET_SIZE);
    set({
      selectedCharacter: character,
      gauntletOpponents: ladder,
      gauntletStage: 0,
      opponent: ladder[0],
      currentStage: randomStageId(),
      playerHealth: character.health,
      opponentHealth: ladder[0].health,
      ...freshBout(),
    });
  },

  // Move to the next, harder opponent — or crown the player champion.
  advanceGauntlet: () => {
    const state = useGameStore.getState();
    const nextStage = state.gauntletStage + 1;

    if (nextStage >= state.gauntletOpponents.length) {
      set({ gameStatus: 'champion' });
      return;
    }

    const nextOpponent = state.gauntletOpponents[nextStage];
    set({
      gauntletStage: nextStage,
      opponent: nextOpponent,
      currentStage: randomStageId(),
      playerHealth: state.selectedCharacter?.health || 100,
      opponentHealth: nextOpponent.health,
      ...freshBout(),
    });
    // The arena shows the VS intro, then starts the countdown.
  },

  performMove: (move) => {
    const state = useGameStore.getState();
    if (state.gameStatus !== 'playing') return;

    // Handle movement
    if (move === 'left') {
      set(state => ({
        playerPosition: Math.max(0, state.playerPosition - 12),
      }));
      return;
    }
    if (move === 'right') {
      set(state => ({
        playerPosition: Math.min(100, state.playerPosition + 12),
      }));
      return;
    }
    if (move === 'jump' && !state.isJumping) {
      set({ isJumping: true });

      // Smooth jump animation
      let jumpHeight = 0;
      const jumpUp = setInterval(() => {
        if (jumpHeight >= 150) {
          clearInterval(jumpUp);
          const fallDown = setInterval(() => {
            if (jumpHeight <= 0) {
              clearInterval(fallDown);
              set({ isJumping: false });
            } else {
              jumpHeight -= 16;
              set({ playerY: jumpHeight });
            }
          }, 16);
        } else {
          jumpHeight += 16;
          set({ playerY: jumpHeight });
        }
      }, 16);

      return;
    }

    set({ isAttacking: true, currentMove: move });
    setTimeout(() => set({ isAttacking: false, currentMove: null }), 600);

    // Check if characters are close enough for hit detection

    const distance = Math.abs(state.playerPosition - state.opponentPosition);
    if (distance > 25) return; // No damage if too far apart

    const damage = state.selectedCharacter?.moves[move] || 0;
    const newOpponentHealth = Math.max(0, state.opponentHealth - damage);
    const hitEvent = { target: 'opponent' as const, amount: damage, move, seq: nextHit() };

    // Knock the opponent back a touch on hit.
    const knockback = move === 'special' ? 8 : 4;
    const knockedPosition = Math.min(100, state.opponentPosition + knockback);

    if (newOpponentHealth <= 0) {
      set({ opponentHealth: 0, opponentPosition: knockedPosition, hitEvent });
      useGameStore.getState().endRound('player');
      return;
    }

    set({ opponentHealth: newOpponentHealth, opponentPosition: knockedPosition, hitEvent });
  },

  opponentAttack: () => {
    const state = useGameStore.getState();
    if (state.gameStatus !== 'playing') return;

    const moves: Move[] = ['punch', 'kick', 'special'];
    const randomMove = moves[Math.floor(Math.random() * moves.length)];

    set({ isOpponentAttacking: true });
    setTimeout(() => set({ isOpponentAttacking: false }), 600);

    // Check if characters are close enough for hit detection
    const distance = Math.abs(state.playerPosition - state.opponentPosition);
    if (distance > 25) return; // No damage if too far apart

    const { damageMult } = difficultyForStage(state.gauntletStage);
    const baseDamage = state.opponent?.moves[randomMove] || 0;
    const damage = Math.round(baseDamage * damageMult);
    const newPlayerHealth = Math.max(0, state.playerHealth - damage);
    const hitEvent = { target: 'player' as const, amount: damage, move: randomMove, seq: nextHit() };

    // Knock the player back a touch on hit.
    const knockback = randomMove === 'special' ? 8 : 4;
    const knockedPosition = Math.max(0, state.playerPosition - knockback);

    if (newPlayerHealth <= 0) {
      set({ playerHealth: 0, playerPosition: knockedPosition, hitEvent });
      useGameStore.getState().endRound('opponent');
    } else {
      set({ playerHealth: newPlayerHealth, playerPosition: knockedPosition, hitEvent });
    }
  },

  opponentAI: () => {
    let aiInterval: ReturnType<typeof setInterval>;

    // Reset per-round attack timing so each bout starts with a fair reaction window.
    aiLastAttackAt = 0;
    aiEnteredRangeAt = 0;

    const runAI = () => {
      const state = useGameStore.getState();
      if (state.gameStatus !== 'playing') {
        clearInterval(aiInterval);
        return;
      }

      const diff = difficultyForStage(state.gauntletStage);
      const distance = Math.abs(state.playerPosition - state.opponentPosition);

      // Move towards player if too far
      if (distance > 25) {
        aiEnteredRangeAt = 0; // out of range — reset the reaction timer
        if (state.playerPosition < state.opponentPosition) {
          set(state => ({
            opponentPosition: Math.max(0, state.opponentPosition - diff.moveSpeed)
          }));
        } else {
          set(state => ({
            opponentPosition: Math.min(100, state.opponentPosition + diff.moveSpeed)
          }));
        }
        return;
      }

      // In range: honour a reaction delay, an attack cooldown, then roll to attack.
      const now = Date.now();
      if (aiEnteredRangeAt === 0) aiEnteredRangeAt = now;

      const reacted = now - aiEnteredRangeAt >= diff.reactionMs;
      const offCooldown = now - aiLastAttackAt >= diff.cooldownMs;

      if (reacted && offCooldown && !state.isOpponentAttacking && Math.random() < diff.attackChance) {
        aiLastAttackAt = now;
        useGameStore.getState().opponentAttack();
      }
    };

    // Run AI loop
    aiInterval = setInterval(runAI, 50);
    return () => clearInterval(aiInterval);
  },

  startCountdown: () => {
    set({
      gameStatus: 'ready',
      countdown: 3,
      timer: 99
    });

    const runTimer = () => {
      const timerInterval = setInterval(() => {
        const state = useGameStore.getState();
        if (state.gameStatus === 'playing' && state.timer > 0) {
          set({ timer: state.timer - 1 });
        } else if (state.gameStatus === 'playing' && state.timer === 0) {
          clearInterval(timerInterval);
          const timeOverState = useGameStore.getState();
          const winner = timeOverState.playerHealth > timeOverState.opponentHealth ? 'player' : 'opponent';
          useGameStore.getState().endRound(winner);
        } else if (state.gameStatus !== 'playing') {
          clearInterval(timerInterval);
        }
      }, 1000);
    };

    const countdownInterval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.countdown > 0) {
        set({ countdown: state.countdown - 1 });
      } else if (state.countdown === 0) {
        setTimeout(() => {
        clearInterval(countdownInterval);
        set({
          gameStatus: 'playing',
          countdown: -1
        });
        // Start opponent AI when round begins
        useGameStore.getState().opponentAI();
        runTimer();
        }, 1000);
      }
    }, 1000);
  },

  endRound: (winner: 'player' | 'opponent') => {
    const state = useGameStore.getState();
    const baseHealth = state.selectedCharacter?.health || 100;
    const opponentBaseHealth = state.opponent?.health || 100;

    // Update wins
    const playerWins = state.playerWins + (winner === 'player' ? 1 : 0);
    const opponentWins = state.opponentWins + (winner === 'opponent' ? 1 : 0);

    // Check if the bout is over (best of 3)
    if (playerWins === 2 || opponentWins === 2) {
      const isFinalStage = state.gauntletStage >= state.gauntletOpponents.length - 1;
      // Player loss ends the run; a win either clears the stage or wins it all.
      const gameStatus = opponentWins === 2 ? 'lost' : isFinalStage ? 'champion' : 'won';

      set({
        playerWins,
        opponentWins,
        gameStatus,
        playerPosition: 15,
        playerY: 0,
        opponentPosition: 65,
        opponentY: 0,
        isJumping: false,
        isAttacking: false,
        isOpponentAttacking: false,
        currentMove: null
      });
    } else {
      // Reset for next round
      set({
        playerWins,
        opponentWins,
        round: state.round + 1,
        gameStatus: 'ready',
        countdown: 3,
        timer: 99,
        playerHealth: baseHealth,
        opponentHealth: opponentBaseHealth,
        playerPosition: 15,
        playerY: 0,
        opponentPosition: 65,
        opponentY: 0,
        isJumping: false,
        isAttacking: false,
        isOpponentAttacking: false,
        currentMove: null
      });
      useGameStore.getState().startCountdown();
    }
  },

  resetGame: () => {
    set({
      playerHealth: 100,
      opponentHealth: 100,
      gameStatus: 'ready',
      round: 1,
      gauntletOpponents: [],
      gauntletStage: 0,
      countdown: 3,
      timer: 99,
      playerWins: 0,
      opponentWins: 0,
      selectedCharacter: null,
      opponent: null,
      playerPosition: 15,
      playerY: 0,
      opponentPosition: 65,
      opponentY: 0,
      isJumping: false,
      isAttacking: false,
      isOpponentAttacking: false,
      currentMove: null
    });
  },

  togglePause: () => set((state) => ({
    gameStatus: state.gameStatus === 'paused' ? 'playing' : 'paused'
  }))
}));
