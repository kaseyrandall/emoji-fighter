import { create } from 'zustand';
import { GameState, Character, Move } from '../types/game';
import { characters } from '../data/characters';
import { stages } from '../data/stages';

interface GameStore extends GameState {
  selectCharacter: (character: Character) => void;
  selectOpponent: () => void;
  performMove: (move: Move) => void;
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
  setAttacking: (value) => set({ isAttacking: value }),

  selectCharacter: (character) => set({ selectedCharacter: character }),
  
  selectOpponent: () => {
    const availableOpponents = characters.filter(
      (char) => char.id !== (useGameStore.getState().selectedCharacter?.id)
    );
    const randomOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
    const randomStage = stages[Math.floor(Math.random() * stages.length)].id;
    set({ opponent: randomOpponent, currentStage: randomStage });
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

    if (newOpponentHealth <= 0) {
      set({ opponentHealth: 0 });
      useGameStore.getState().endRound('player');
      return;
    }
    
    set({ opponentHealth: newOpponentHealth });
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

    const damage = state.opponent?.moves[randomMove] || 0;
    const newPlayerHealth = Math.max(0, state.playerHealth - damage);

    if (newPlayerHealth <= 0) {
      set({ playerHealth: 0 });
      useGameStore.getState().endRound('opponent');
    } else {
      set({ playerHealth: newPlayerHealth });
    }
  },

  opponentAI: () => {
    let aiInterval: NodeJS.Timeout;
    
    const runAI = () => {
      const state = useGameStore.getState();
      if (state.gameStatus !== 'playing') {
        clearInterval(aiInterval);
        return;
      }

      // Calculate distance to player
      const distance = Math.abs(state.playerPosition - state.opponentPosition);

      // Move towards player if too far
      if (distance > 25) {
        if (state.playerPosition < state.opponentPosition) {
          set(state => ({ 
            opponentPosition: Math.max(0, state.opponentPosition - 2)
          }));
        } else {
          set(state => ({ 
            opponentPosition: Math.min(100, state.opponentPosition + 2)
          }));
        }
      }
      
      // Attack if in range
      if (distance < 25 && !state.isOpponentAttacking) {
        const attackChance = Math.random();
        if (attackChance > 0.92) {
          useGameStore.getState().opponentAttack();
        }
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

    // Check if match is over (best of 3)
    if (playerWins === 2 || opponentWins === 2) {
      set({
        playerWins,
        opponentWins,
        gameStatus: playerWins === 2 ? 'won' : 'lost',
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