import { create } from 'zustand';
import { GameState, Character, Move } from '../types/game';
import { characters } from '../data/characters';
import { stages } from '../data/stages';

// Monotonic id so the UI re-triggers VFX even for identical damage values.
let hitSeq = 0;
const nextHit = () => ++hitSeq;

// How many opponents make up the gauntlet ladder (or all of them, if fewer).
export const GAUNTLET_SIZE = Math.min(6, characters.length - 1);

// Fighters are positioned by their left edge as a % of the arena. Bounds let a
// fighter hang roughly half off either edge, but never disappear entirely.
const POS_MIN = -10;
const POS_MAX = 92;

// Player horizontal physics — velocity with acceleration and friction, so the
// fighter has weight and momentum instead of teleporting in fixed steps.
const MOVE_TICK_MS = 16;
const PLAYER_MAX_SPEED = 1.05; // % of arena per tick at full input
const PLAYER_ACCEL = 0.16; // how fast velocity eases toward the target
const PLAYER_FRICTION = 0.8; // velocity retained per tick when no input

// AI timing state for the current round (reset when a round's AI loop starts).
let aiLastAttackAt = 0;
let aiEnteredRangeAt = 0;

// Single-instance loop handles so a new round never leaves an old loop running
// (leaked loops would fight over movement and appear to "break" the controls).
let aiLoop: ReturnType<typeof setInterval> | undefined;
let physicsLoop: ReturnType<typeof setInterval> | undefined;
let countdownLoop: ReturnType<typeof setInterval> | undefined;
let roundTimerLoop: ReturnType<typeof setInterval> | undefined;
const clearRoundLoops = () => {
  if (countdownLoop) { clearInterval(countdownLoop); countdownLoop = undefined; }
  if (roundTimerLoop) { clearInterval(roundTimerLoop); roundTimerLoop = undefined; }
};

// Recovery between the player's own attacks, so mashing can't stack hits and
// combat has a rhythm instead of a one-sided slam.
const PLAYER_ATTACK_COOLDOWN = 340;
let playerLastAttackAt = 0;

// Reach, in position units (fighters are ~12 units wide). Punches/kicks only
// connect at near-contact; the special reaches a little further. The AI uses
// HIT_RANGE to decide it's close enough to start throwing attacks.
const HIT_RANGE = 15;
const SPECIAL_RANGE = 19;

// Super meter: landing punches/kicks charges it; the special can only fire when
// it's full, then it's spent. A full-meter special hits harder than a raw one.
const SPECIAL_METER_MAX = 100;
const SPECIAL_GAIN = 20; // meter gained per landed punch/kick
const SPECIAL_SUPER_MULT = 1.4;

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

// A player-chosen base difficulty shifts the whole curve up or down.
export type DifficultyLevel = 'Easy' | 'Normal' | 'Hard';
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['Easy', 'Normal', 'Hard'];
const DIFF_OFFSET: Record<DifficultyLevel, number> = { Easy: -1.5, Normal: 0, Hard: 1.75 };

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
  playerFacing: 'right' as const,
  moveDir: 0,
  playerVel: 0,
  specialMeter: 0,
});

interface GameStore extends GameState {
  difficulty: DifficultyLevel;
  setDifficulty: (level: DifficultyLevel) => void;
  selectCharacter: (character: Character) => void;
  selectOpponent: () => void;
  startGauntlet: (character: Character) => void;
  advanceGauntlet: () => void;
  moveDir: number;
  playerVel: number;
  setMoveDir: (dir: number) => void;
  specialMeter: number;
  performMove: (move: Move) => void;
  performSpecial: () => void;
  endRound: (winner: 'player' | 'opponent') => void;
  resetGame: () => void;
  togglePause: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  playerPosition: number;
  opponentPosition: number;
  isAttacking: boolean;
  isOpponentAttacking: boolean;
  setAttacking: (value: boolean) => void;
  startCountdown: () => void;
  opponentAttack: () => void;
  opponentAI: () => void;
  playerPhysics: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  selectedCharacter: null,
  opponent: null,
  difficulty: 'Normal',
  setDifficulty: (level) => set({ difficulty: level }),
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
  playerFacing: 'right',
  moveDir: 0,
  playerVel: 0,
  specialMeter: 0,
  setMoveDir: (dir) => set({ moveDir: Math.max(-1, Math.min(1, dir)) }),
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

    // Horizontal movement is velocity-based now (see the physics loop); the
    // 'left' / 'right' moves just set the input direction.
    if (move === 'left') {
      useGameStore.getState().setMoveDir(-1);
      return;
    }
    if (move === 'right') {
      useGameStore.getState().setMoveDir(1);
      return;
    }
    if (move === 'jump' && !state.isJumping) {
      set({ isJumping: true });

      // Smooth jump animation
      let jumpHeight = 0;
      const jumpUp = setInterval(() => {
        if (jumpHeight >= 230) {
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

    // Attacks (punch / kick / special) — enforce a recovery window.
    const nowAttack = Date.now();
    if (nowAttack - playerLastAttackAt < PLAYER_ATTACK_COOLDOWN) return;
    playerLastAttackAt = nowAttack;

    set({ isAttacking: true, currentMove: move });
    setTimeout(() => set({ isAttacking: false, currentMove: null }), 600);

    // Check if characters are close enough for hit detection

    const distance = Math.abs(state.playerPosition - state.opponentPosition);
    if (distance > HIT_RANGE) return; // No damage if too far apart

    const damage = state.selectedCharacter?.moves[move] || 0;
    const newOpponentHealth = Math.max(0, state.opponentHealth - damage);
    const hitEvent = { target: 'opponent' as const, amount: damage, move, seq: nextHit() };

    // Knock the opponent back a touch on hit.
    const knockedPosition = Math.min(POS_MAX, state.opponentPosition + 4);
    // Landing an attack charges the super meter.
    const specialMeter = Math.min(SPECIAL_METER_MAX, state.specialMeter + SPECIAL_GAIN);

    if (newOpponentHealth <= 0) {
      set({ opponentHealth: 0, opponentPosition: knockedPosition, hitEvent, specialMeter });
      useGameStore.getState().endRound('player');
      return;
    }

    set({ opponentHealth: newOpponentHealth, opponentPosition: knockedPosition, hitEvent, specialMeter });
  },

  // The special is a super: usable only when the meter is full (charged by
  // landing attacks), and it's spent on use.
  performSpecial: () => {
    const state = useGameStore.getState();
    if (state.gameStatus !== 'playing') return;
    if (state.specialMeter < SPECIAL_METER_MAX) return; // not charged yet

    const now = Date.now();
    if (now - playerLastAttackAt < PLAYER_ATTACK_COOLDOWN) return;
    playerLastAttackAt = now;

    // Spend the meter on activation.
    set({ isAttacking: true, currentMove: 'special', specialMeter: 0 });
    setTimeout(() => set({ isAttacking: false, currentMove: null }), 600);

    const distance = Math.abs(state.playerPosition - state.opponentPosition);
    if (distance > SPECIAL_RANGE) return;

    const base = state.selectedCharacter?.moves.special || 0;
    const damage = Math.round(base * SPECIAL_SUPER_MULT);
    const newOpponentHealth = Math.max(0, state.opponentHealth - damage);
    const hitEvent = { target: 'opponent' as const, amount: damage, move: 'special' as const, seq: nextHit() };

    const knockedPosition = Math.min(POS_MAX, state.opponentPosition + 14);

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
    if (distance > HIT_RANGE) return; // No damage if too far apart

    const { damageMult } = difficultyForStage(state.gauntletStage + DIFF_OFFSET[state.difficulty]);
    const baseDamage = state.opponent?.moves[randomMove] || 0;
    const damage = Math.round(baseDamage * damageMult);
    const newPlayerHealth = Math.max(0, state.playerHealth - damage);
    const hitEvent = { target: 'player' as const, amount: damage, move: randomMove, seq: nextHit() };

    // Knock the player back a touch on hit.
    const knockback = randomMove === 'special' ? 8 : 4;
    const knockedPosition = Math.max(POS_MIN, state.playerPosition - knockback);

    if (newPlayerHealth <= 0) {
      set({ playerHealth: 0, playerPosition: knockedPosition, hitEvent });
      useGameStore.getState().endRound('opponent');
    } else {
      set({ playerHealth: newPlayerHealth, playerPosition: knockedPosition, hitEvent });
    }
  },

  opponentAI: () => {
    // Never run two AI loops at once.
    if (aiLoop) clearInterval(aiLoop);

    // Reset per-round attack timing so each bout starts with a fair reaction window.
    aiLastAttackAt = 0;
    aiEnteredRangeAt = 0;

    const runAI = () => {
      const state = useGameStore.getState();
      if (state.gameStatus !== 'playing') {
        if (aiLoop) { clearInterval(aiLoop); aiLoop = undefined; }
        return;
      }

      const diff = difficultyForStage(state.gauntletStage + DIFF_OFFSET[state.difficulty]);
      const distance = Math.abs(state.playerPosition - state.opponentPosition);

      // Move towards player if too far
      if (distance > HIT_RANGE) {
        aiEnteredRangeAt = 0; // out of range — reset the reaction timer
        if (state.playerPosition < state.opponentPosition) {
          set(state => ({
            opponentPosition: Math.max(POS_MIN, state.opponentPosition - diff.moveSpeed)
          }));
        } else {
          set(state => ({
            opponentPosition: Math.min(POS_MAX, state.opponentPosition + diff.moveSpeed)
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
    aiLoop = setInterval(runAI, 50);
  },

  // Integrate the player's horizontal velocity each tick: ease toward the input
  // direction, coast with friction when released, and stop dead at the walls.
  playerPhysics: () => {
    // Never run two physics loops at once.
    if (physicsLoop) clearInterval(physicsLoop);
    physicsLoop = setInterval(() => {
      const s = useGameStore.getState();
      if (s.gameStatus !== 'playing') {
        if (physicsLoop) { clearInterval(physicsLoop); physicsLoop = undefined; }
        return;
      }

      const target = s.moveDir * PLAYER_MAX_SPEED;
      let vel = s.moveDir !== 0
        ? s.playerVel + (target - s.playerVel) * PLAYER_ACCEL
        : s.playerVel * PLAYER_FRICTION;
      if (Math.abs(vel) < 0.02) vel = 0;

      let pos = s.playerPosition + vel;
      if (pos <= POS_MIN) { pos = POS_MIN; vel = 0; }
      if (pos >= POS_MAX) { pos = POS_MAX; vel = 0; }

      if (pos === s.playerPosition && vel === 0 && s.playerVel === 0) return;

      const patch: Partial<GameState> & { playerVel: number } = { playerPosition: pos, playerVel: vel };
      if (s.moveDir < -0.05) patch.playerFacing = 'left';
      else if (s.moveDir > 0.05) patch.playerFacing = 'right';
      set(patch);
    }, MOVE_TICK_MS);
  },

  startCountdown: () => {
    // Single-instance loops: clear any leftovers so the timer can't run at
    // double/half speed from an overlapping interval.
    clearRoundLoops();
    set({
      gameStatus: 'ready',
      countdown: 3,
      timer: 99
    });

    // Exactly one round timer, ticking once per second while the round is live.
    const startRoundTimer = () => {
      if (roundTimerLoop) clearInterval(roundTimerLoop);
      roundTimerLoop = setInterval(() => {
        const s = useGameStore.getState();
        if (s.gameStatus !== 'playing') {
          if (roundTimerLoop) { clearInterval(roundTimerLoop); roundTimerLoop = undefined; }
          return;
        }
        if (s.timer > 0) {
          set({ timer: s.timer - 1 });
        } else {
          if (roundTimerLoop) { clearInterval(roundTimerLoop); roundTimerLoop = undefined; }
          const winner = s.playerHealth > s.opponentHealth ? 'player' : 'opponent';
          useGameStore.getState().endRound(winner);
        }
      }, 1000);
    };

    // 3 · 2 · 1 · FIGHT, then the round goes live. Clearing the countdown loop
    // the instant it completes avoids a leftover tick re-triggering the start.
    countdownLoop = setInterval(() => {
      const c = useGameStore.getState().countdown;
      if (c > 0) {
        set({ countdown: c - 1 });
        return;
      }
      // c === 0 → go live once.
      if (countdownLoop) { clearInterval(countdownLoop); countdownLoop = undefined; }
      set({ gameStatus: 'playing', countdown: -1 });
      useGameStore.getState().opponentAI();
      useGameStore.getState().playerPhysics();
      startRoundTimer();
    }, 1000);
  },

  endRound: (winner: 'player' | 'opponent') => {
    const state = useGameStore.getState();
    // Only a live round can end. This guards against two near-simultaneous KOs
    // (e.g. rapid hits) both resolving the same round and double-counting a win.
    if (state.gameStatus !== 'playing') return;

    // Stop the round timer/countdown immediately; the next bout restarts them.
    clearRoundLoops();

    const baseHealth = state.selectedCharacter?.health || 100;
    const opponentBaseHealth = state.opponent?.health || 100;

    // Update wins
    const playerWins = state.playerWins + (winner === 'player' ? 1 : 0);
    const opponentWins = state.opponentWins + (winner === 'opponent' ? 1 : 0);

    // Check if the bout is over (best of 3)
    if (playerWins >= 2 || opponentWins >= 2) {
      const isFinalStage = state.gauntletStage >= state.gauntletOpponents.length - 1;
      // Player loss ends the run; a win either clears the stage or wins it all.
      const gameStatus = opponentWins >= 2 ? 'lost' : isFinalStage ? 'champion' : 'won';

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
        currentMove: null,
        playerFacing: 'right',
        moveDir: 0,
        playerVel: 0,
        specialMeter: 0
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
        currentMove: null,
        playerFacing: 'right',
        moveDir: 0,
        playerVel: 0,
        specialMeter: 0
      });
      useGameStore.getState().startCountdown();
    }
  },

  resetGame: () => {
    clearRoundLoops();
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
      currentMove: null,
      playerFacing: 'right',
      moveDir: 0,
      playerVel: 0,
      specialMeter: 0
    });
  },

  togglePause: () => set((state) =>
    state.gameStatus === 'paused'
      ? { gameStatus: 'playing' }
      : state.gameStatus === 'playing'
      ? { gameStatus: 'paused' }
      : {}
  ),

  // Idempotent so a stray double-tap can't bounce the game straight back:
  // pausing twice stays paused, resuming twice stays playing.
  pauseGame: () => set((state) => (state.gameStatus === 'playing' ? { gameStatus: 'paused' } : {})),
  resumeGame: () => set((state) => (state.gameStatus === 'paused' ? { gameStatus: 'playing' } : {}))
}));
