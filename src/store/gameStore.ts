import { create } from 'zustand';
import { GameState, Character, Move, AttackMove, HitEvent, HitResult } from '../types/game';
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
let aiLastCrossAt = 0;
// An in-progress AI cross-up: the opponent jumps over the player to land at
// `target`, drifting `step` units per movement tick while airborne.
let oppCross: { target: number; step: number } | undefined;

// Single-instance loop handles so a new round never leaves an old loop running
// (leaked loops would fight over movement and appear to "break" the controls).
let aiLoop: ReturnType<typeof setInterval> | undefined;
let physicsLoop: ReturnType<typeof setInterval> | undefined;
let countdownLoop: ReturnType<typeof setInterval> | undefined;
let roundTimerLoop: ReturnType<typeof setInterval> | undefined;
// Jump arcs run on their own intervals; tracked so a round that ends mid-jump
// can stop them, otherwise a leaked arc keeps writing playerY/opponentY and the
// fighter visibly bounces during the next round's countdown.
let playerJumpLoop: ReturnType<typeof setInterval> | undefined;
let oppJumpLoop: ReturnType<typeof setInterval> | undefined;
// The KO beat between a round ending and the next round (or the win/lose
// screen). Tracked so a quit/reset can cancel it.
let roundEndTimeout: ReturnType<typeof setTimeout> | undefined;
const KO_DURATION = 1500;
const clearRoundLoops = () => {
  if (countdownLoop) { clearInterval(countdownLoop); countdownLoop = undefined; }
  if (roundTimerLoop) { clearInterval(roundTimerLoop); roundTimerLoop = undefined; }
  if (playerJumpLoop) { clearInterval(playerJumpLoop); playerJumpLoop = undefined; }
  if (oppJumpLoop) { clearInterval(oppJumpLoop); oppJumpLoop = undefined; }
  oppCross = undefined;
  if (oppGuardTimeout) { clearTimeout(oppGuardTimeout); oppGuardTimeout = undefined; }
  pendingHits.forEach(clearTimeout);
  pendingHits.clear();
  if (roundEndTimeout) { clearTimeout(roundEndTimeout); roundEndTimeout = undefined; }
};

// Recovery between the player's own attacks, so mashing can't stack hits and
// combat has a rhythm instead of a one-sided slam.
const PLAYER_ATTACK_COOLDOWN = 340;
// The heavy punch is slow: a wind-up before it lands (matching the 3D
// uppercut's impact frame) and a long recovery that leaves you open.
const HEAVY_ATTACK_COOLDOWN = 700;
const HEAVY_STARTUP_MS = 300;
// Delayed hits (the heavy's wind-up) in flight; cancelled when a round ends.
const pendingHits = new Set<ReturnType<typeof setTimeout>>();
const afterStartup = (move: AttackMove, land: () => void) => {
  if (move !== 'heavy') return land();
  const t = setTimeout(() => {
    pendingHits.delete(t);
    if (useGameStore.getState().gameStatus === 'playing') land();
  }, HEAVY_STARTUP_MS);
  pendingHits.add(t);
};
let playerLastAttackAt = 0;
let playerCooldown = PLAYER_ATTACK_COOLDOWN; // recovery owed by the last attack

// Reach, in position units (fighters are ~12 units wide). Punches only
// connect at near-contact; the special reaches a little further. The AI uses
// HIT_RANGE to decide it's close enough to start throwing attacks.
const HIT_RANGE = 15;
// Closest the two fighters can get on the ground (bodies are ~12 units wide),
// so they bump into each other instead of walking through. Jumping clears it.
const MIN_SEPARATION = 11;
// Knock `victim` away from `attacker` (whichever side they're on now that
// fighters can cross over), staying inside the arena.
const knockAway = (victim: number, attacker: number, amount: number) =>
  Math.max(POS_MIN, Math.min(POS_MAX, victim + (Math.sign(victim - attacker) || 1) * amount));
const SPECIAL_RANGE = 19;

// Super meter: landing punches charges it; the special can only fire when
// it's full, then it's spent. A full-meter special hits harder than a raw one.
const SPECIAL_METER_MAX = 100;
const SPECIAL_GAIN = 20; // meter gained per landed punch / heavy punch
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

// Peak of the jump arc, in px. The arena scales this down when a short
// viewport can't fit the whole arc (see jumpScale in GameArena).
export const JUMP_PEAK = 230;
const JUMP_STEP = 16;
// The player's jump: a parabola lasting this many 16ms ticks (~0.64s), with a
// small speed boost when taking off in a direction.
const PLAYER_JUMP_TICKS = 40;
const JUMP_SPEED_BOOST = 1.1;
// Horizontal momentum kept per tick in the air with no input (vs
// PLAYER_FRICTION on the ground), so a jump carries its speed.
const AIR_FRICTION = 0.97;
// Above this height a fighter is "over" the other one and can pass across.
const CLEAR_HEIGHT = JUMP_PEAK * 0.2;
// Jump dodging: attacks only reach so far vertically. A jab needs both
// fighters at roughly the same height, so jumping clears it. The uppercut
// reaches up (a jumper coming in can be anti-aired) but not down. Specials
// are big enough to catch anyone.
const DODGE_HEIGHT = JUMP_PEAK * 0.35;
const reaches = (move: AttackMove, attackerY: number, targetY: number) =>
  move === 'special' ||
  (move === 'punch' && Math.abs(attackerY - targetY) <= DODGE_HEIGHT) ||
  (move === 'heavy' && targetY - attackerY >= -DODGE_HEIGHT);

// Blocking: guarded attacks deal only chip damage and barely push back.
const BLOCK_CHIP = 0.2;
const SPECIAL_BLOCK_CHIP = 0.35;
const BLOCK_KNOCKBACK = 2;
const OPP_GUARD_MS = 380; // how long the AI's guard pose shows after a block

// The player blocks by holding away from the opponent while on the ground
// (they can still back-pedal at the same time, as in any fighting game).
export const isPlayerBlocking = (s: { gameStatus: string; playerY: number; moveDir: number; playerPosition: number; opponentPosition: number }) =>
  s.gameStatus === 'playing' &&
  s.playerY < 1 &&
  s.moveDir !== 0 &&
  Math.sign(s.moveDir) === (Math.sign(s.playerPosition - s.opponentPosition) || -1);

// The AI's odds of blocking a given attack rise through the gauntlet.
const aiBlockChance = (stage: number) => Math.max(0, Math.min(0.45, 0.08 + stage * 0.07));
let oppGuardTimeout: ReturnType<typeof setTimeout> | undefined;
const AI_SWING_MS = 280; // the AI can't guard this soon after throwing an attack
// How often the AI answers a jumping player with the anti-air uppercut.
// Once its meter is full, the odds the AI cashes it in on a given attack.
const aiSpecialChance = (stage: number) => Math.max(0.35, Math.min(0.85, 0.35 + stage * 0.1));
const aiAntiAirChance = (stage: number) => Math.max(0.2, Math.min(0.75, 0.3 + stage * 0.09));

// The opponent's jump arc, and how many 16ms ticks it spends in the air.
const OPP_JUMP_PEAK = JUMP_PEAK * 0.85;
const OPP_JUMP_TICKS = 2 * Math.ceil(OPP_JUMP_PEAK / JUMP_STEP);
// AI cross-ups: how far past the player it lands, and the minimum gap
// between two of them (shrinks as the gauntlet gets harder).
const CROSS_UP_LAND = 14;
const crossUpGapMs = (stage: number) => Math.max(1800, 4000 - stage * 400);

// State shared by startGauntlet / advanceGauntlet when a fresh bout begins.
// Bouts open on the 'intro' VS screen; the arena starts the countdown after it.
const freshBout = () => ({
  gameStatus: 'intro' as const,
  round: 1,
  roundLoser: null,
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
  opponentSpecialMeter: 0,
  opponentMove: null,
  opponentBlocking: false,
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
  // The AI's super meter: charged and spent exactly like the player's.
  opponentSpecialMeter: number;
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
  // The AI is showing its guard (it just blocked an attack).
  opponentBlocking: boolean;
  // Which attack the opponent is throwing (drives its 3D swing animation).
  opponentMove: AttackMove | null;
  // Bumped once per attack thrown, so the 3D rigs can start a swing on each
  // new attack — even when two land inside the same 600ms isAttacking window.
  playerAttackSeq: number;
  opponentAttackSeq: number;
  setAttacking: (value: boolean) => void;
  startCountdown: () => void;
  opponentAttack: () => void;
  opponentAI: () => void;
  playerPhysics: () => void;
}

// Damage a guarded attack still deals.
const chip = (move: AttackMove, damage: number) =>
  Math.max(1, Math.round(damage * (move === 'special' ? SPECIAL_BLOCK_CHIP : BLOCK_CHIP)));

// Resolve a player attack that's already in horizontal range: it may be
// jump-dodged, blocked by the AI, or land. Applies damage/knockback, emits the
// hit event, ends the round on a KO, and returns how it resolved.
function resolveOnOpponent(move: AttackMove, damage: number, knockback: number): HitResult {
  const { getState: get, setState: set } = useGameStore;
  const s = get();
  if (!reaches(move, s.playerY, s.opponentY)) {
    set({ hitEvent: { target: 'opponent', amount: 0, move, seq: nextHit(), result: 'dodged' } });
    return 'dodged';
  }

  // The AI can only guard on the ground and not in the middle of a swing.
  const stage = s.gauntletStage + DIFF_OFFSET[s.difficulty];
  const midSwing = Date.now() - aiLastAttackAt < AI_SWING_MS;
  const blocked = s.opponentY < 1 && !midSwing && Math.random() < aiBlockChance(stage);
  const dealt = blocked ? chip(move, damage) : damage;
  const opponentHealth = Math.max(0, s.opponentHealth - dealt);
  const opponentPosition = knockAway(s.opponentPosition, s.playerPosition, blocked ? BLOCK_KNOCKBACK : knockback);
  const result: HitResult = blocked ? 'blocked' : 'hit';
  const hitEvent: HitEvent = { target: 'opponent', amount: dealt, move, seq: nextHit(), result };

  if (blocked) {
    if (oppGuardTimeout) clearTimeout(oppGuardTimeout);
    oppGuardTimeout = setTimeout(() => set({ opponentBlocking: false }), OPP_GUARD_MS);
  }
  set({ opponentHealth, opponentPosition, hitEvent, opponentBlocking: blocked });
  if (opponentHealth <= 0) get().endRound('player');
  return result;
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
  roundLoser: null,
  gauntletOpponents: [],
  gauntletStage: 0,
  playerPosition: 15,
  playerY: 0,
  opponentPosition: 65,
  opponentY: 0,
  isAttacking: false,
  isOpponentAttacking: false,
  currentMove: null,
  currentStage: stages[0].id,
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
  opponentSpecialMeter: 0,
  opponentMove: null,
  opponentBlocking: false,
  playerAttackSeq: 0,
  opponentAttackSeq: 0,
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
      // Jumping while holding a direction commits to it at full speed, so a
      // jump toward the opponent reliably carries you over them.
      const takeoffVel = state.moveDir !== 0 ? Math.sign(state.moveDir) * PLAYER_MAX_SPEED * JUMP_SPEED_BOOST : state.playerVel;
      set({ isJumping: true, playerVel: takeoffVel });

      // One tracked parabolic arc. It bails if the round ends mid-jump so it
      // can't keep writing playerY into the next round's reset.
      if (playerJumpLoop) clearInterval(playerJumpLoop);
      let tick = 0;
      playerJumpLoop = setInterval(() => {
        // Paused: hold still, keeping the loop alive until resumed.
        if (useGameStore.getState().gameStatus === 'paused') return;
        if (useGameStore.getState().gameStatus !== 'playing') {
          if (playerJumpLoop) { clearInterval(playerJumpLoop); playerJumpLoop = undefined; }
          return;
        }
        tick++;
        if (tick >= PLAYER_JUMP_TICKS) {
          if (playerJumpLoop) { clearInterval(playerJumpLoop); playerJumpLoop = undefined; }
          set({ playerY: 0, isJumping: false });
          return;
        }
        const x = tick / PLAYER_JUMP_TICKS;
        set({ playerY: JUMP_PEAK * 4 * x * (1 - x) });
      }, 16);

      return;
    }

    // Attacks (punch / heavy / special) — enforce a recovery window.
    const nowAttack = Date.now();
    if (nowAttack - playerLastAttackAt < playerCooldown) return;
    playerLastAttackAt = nowAttack;
    playerCooldown = move === 'heavy' ? HEAVY_ATTACK_COOLDOWN : PLAYER_ATTACK_COOLDOWN;

    set({ isAttacking: true, currentMove: move, playerAttackSeq: state.playerAttackSeq + 1 });
    setTimeout(() => set({ isAttacking: false, currentMove: null }), 600);

    // The hit is checked when the blow lands (after the heavy's wind-up),
    // against where both fighters are at that moment.
    const attack = move as AttackMove;
    afterStartup(attack, () => {
      const now = useGameStore.getState();
      const distance = Math.abs(now.playerPosition - now.opponentPosition);
      if (distance > HIT_RANGE) return; // No damage if too far apart

      const base = now.selectedCharacter?.moves[attack] || 0;
      // Landing an attack charges the super meter (half as much when blocked).
      const gain = (r: HitResult) => (r === 'hit' ? SPECIAL_GAIN : r === 'blocked' ? SPECIAL_GAIN / 2 : 0);
      const result = resolveOnOpponent(attack, base, 4);
      set({ specialMeter: Math.min(SPECIAL_METER_MAX, useGameStore.getState().specialMeter + gain(result)) });
    });
  },

  // The special is a super: usable only when the meter is full (charged by
  // landing attacks), and it's spent on use.
  performSpecial: () => {
    const state = useGameStore.getState();
    if (state.gameStatus !== 'playing') return;
    if (state.specialMeter < SPECIAL_METER_MAX) return; // not charged yet

    const now = Date.now();
    if (now - playerLastAttackAt < playerCooldown) return;
    playerLastAttackAt = now;
    playerCooldown = PLAYER_ATTACK_COOLDOWN;

    // Spend the meter on activation.
    set({ isAttacking: true, currentMove: 'special', specialMeter: 0, playerAttackSeq: state.playerAttackSeq + 1 });
    setTimeout(() => set({ isAttacking: false, currentMove: null }), 600);

    const distance = Math.abs(state.playerPosition - state.opponentPosition);
    if (distance > SPECIAL_RANGE) return;

    const base = state.selectedCharacter?.moves.special || 0;
    resolveOnOpponent('special', Math.round(base * SPECIAL_SUPER_MULT), 14);
  },

  opponentAttack: () => {
    const state = useGameStore.getState();
    if (state.gameStatus !== 'playing') return;

    // Against a jumping player, the AI reaches for the anti-air uppercut —
    // rarely early in the gauntlet, most of the time near the end. Like the
    // player, it can only throw its special once its super meter is full.
    const stage = state.gauntletStage + DIFF_OFFSET[state.difficulty];
    const charged = state.opponentSpecialMeter >= SPECIAL_METER_MAX;
    const randomMove: AttackMove = state.playerY > DODGE_HEIGHT && Math.random() < aiAntiAirChance(stage)
      ? 'heavy'
      : charged && Math.random() < aiSpecialChance(stage)
      ? 'special'
      : Math.random() < 0.6 ? 'punch' : 'heavy';

    set({
      isOpponentAttacking: true,
      opponentMove: randomMove,
      opponentAttackSeq: state.opponentAttackSeq + 1,
      // The special spends the whole meter as it's thrown, hit or miss.
      ...(randomMove === 'special' ? { opponentSpecialMeter: 0 } : {}),
    });
    setTimeout(() => set({ isOpponentAttacking: false }), 600);

    // Resolved when the blow lands (after the heavy's wind-up), against
    // where both fighters are at that moment.
    afterStartup(randomMove, () => {
      const state = useGameStore.getState();
      const special = randomMove === 'special';
      const distance = Math.abs(state.playerPosition - state.opponentPosition);
      if (distance > (special ? SPECIAL_RANGE : HIT_RANGE)) return; // No damage if too far apart

      if (!reaches(randomMove, state.opponentY, state.playerY)) {
        set({ hitEvent: { target: 'player', amount: 0, move: randomMove, seq: nextHit(), result: 'dodged' } });
        return;
      }

      // The same super as the player's: a full-meter special hits harder.
      const { damageMult } = difficultyForStage(state.gauntletStage + DIFF_OFFSET[state.difficulty]);
      const baseDamage = Math.round((state.opponent?.moves[randomMove] || 0) * damageMult * (special ? SPECIAL_SUPER_MULT : 1));
      const blocked = isPlayerBlocking(state);
      const damage = blocked ? chip(randomMove, baseDamage) : baseDamage;
      const hitEvent: HitEvent = { target: 'player', amount: damage, move: randomMove, seq: nextHit(), result: blocked ? 'blocked' : 'hit' };

      // Knock the player back (just a nudge when guarded).
      const knockback = blocked ? BLOCK_KNOCKBACK : special ? 14 : 4;
      const knockedPosition = knockAway(state.playerPosition, state.opponentPosition, knockback);
      const newPlayerHealth = Math.max(0, state.playerHealth - damage);
      // Landing a punch charges the AI's meter, half as much when blocked,
      // exactly as for the player (a special charges nothing).
      const gain = special ? 0 : blocked ? SPECIAL_GAIN / 2 : SPECIAL_GAIN;
      const opponentSpecialMeter = Math.min(SPECIAL_METER_MAX, state.opponentSpecialMeter + gain);

      if (newPlayerHealth <= 0) {
        set({ playerHealth: 0, playerPosition: knockedPosition, hitEvent, opponentSpecialMeter });
        useGameStore.getState().endRound('opponent');
      } else {
        set({ playerHealth: newPlayerHealth, playerPosition: knockedPosition, hitEvent, opponentSpecialMeter });
      }
    });
  },

  opponentAI: () => {
    // Never run two AI loops at once.
    if (aiLoop) clearInterval(aiLoop);

    // Reset per-round attack timing so each bout starts with a fair reaction window.
    aiLastAttackAt = 0;
    aiEnteredRangeAt = 0;
    aiLastCrossAt = Date.now(); // no cross-up in the opening moments
    oppCross = undefined;

    // A tracked arc for the opponent, mirroring the player's jump. Guarded so
    // only one runs at a time and it stops if the round ends mid-air.
    const startOppJump = () => {
      if (oppJumpLoop) return; // already airborne
      let h = 0;
      let dir = 1;
      oppJumpLoop = setInterval(() => {
        // Paused: hold still, keeping the loop alive until resumed.
        if (useGameStore.getState().gameStatus === 'paused') return;
        if (useGameStore.getState().gameStatus !== 'playing') {
          if (oppJumpLoop) { clearInterval(oppJumpLoop); oppJumpLoop = undefined; }
          oppCross = undefined;
          set({ opponentY: 0 });
          return;
        }
        h += dir * JUMP_STEP;
        if (h >= OPP_JUMP_PEAK) { h = OPP_JUMP_PEAK; dir = -1; }
        if (h <= 0) {
          if (oppJumpLoop) { clearInterval(oppJumpLoop); oppJumpLoop = undefined; }
          oppCross = undefined;
          set({ opponentY: 0 });
          return;
        }
        set({ opponentY: h });
      }, 16);
    };

    const runAI = () => {
      const state = useGameStore.getState();
      // Paused: hold still, keeping the loop alive until resumed.
      if (state.gameStatus === 'paused') return;
      if (state.gameStatus !== 'playing') {
        if (aiLoop) { clearInterval(aiLoop); aiLoop = undefined; }
        return;
      }

      const stage = state.gauntletStage + DIFF_OFFSET[state.difficulty];
      const diff = difficultyForStage(stage);
      const distance = Math.abs(state.playerPosition - state.opponentPosition);
      const airborne = !!oppJumpLoop;
      // Jump aggression scales with difficulty; per 50ms tick.
      const jumpChance = Math.min(0.06, 0.015 + stage * 0.006);
      const playerAirborne = state.playerY > JUMP_PEAK * 0.35;

      // Out of range: the horizontal approach is integrated by the 60fps
      // movement loop (so the opponent glides as smoothly as the player); here
      // the AI only decides whether to hop in while closing.
      if (distance > HIT_RANGE) {
        aiEnteredRangeAt = 0; // out of range — reset the reaction timer
        if (!airborne && distance < 45 && Math.random() < jumpChance) startOppJump();
        return;
      }

      // In range: honour a reaction delay, an attack cooldown, then roll to attack.
      const now = Date.now();
      if (aiEnteredRangeAt === 0) aiEnteredRangeAt = now;

      const reacted = now - aiEnteredRangeAt >= diff.reactionMs;
      const offCooldown = now - aiLastAttackAt >= diff.cooldownMs;

      // Mid cross-up: no attacks until it has landed on the other side.
      if (oppCross) return;

      // Now and then, jump right over the player and land behind them —
      // more often, and sooner after the last one, as the gauntlet climbs.
      const crossChance = Math.max(0, Math.min(0.03, 0.006 + stage * 0.004));
      if (!airborne && reacted && now - aiLastCrossAt >= crossUpGapMs(stage) && Math.random() < crossChance) {
        const dir = Math.sign(state.playerPosition - state.opponentPosition) || 1;
        const target = state.playerPosition + dir * CROSS_UP_LAND;
        // Only if there's room to land behind the player (not pinned to a wall).
        if (target >= POS_MIN && target <= POS_MAX) {
          aiLastCrossAt = now;
          oppCross = { target, step: Math.abs(target - state.opponentPosition) / (OPP_JUMP_TICKS - 2) };
          startOppJump();
          return;
        }
      }

      // React to the player leaping: contest the air / anti-air by jumping too.
      if (!airborne && playerAirborne && Math.random() < jumpChance * 2) {
        startOppJump();
      }

      if (reacted && offCooldown && !state.isOpponentAttacking && Math.random() < diff.attackChance) {
        aiLastAttackAt = now;
        useGameStore.getState().opponentAttack();
      } else if (!airborne && reacted && offCooldown && Math.random() < jumpChance * 0.6) {
        // Occasionally hop in place to reposition instead of trading blows.
        startOppJump();
      }
    };

    // Run AI loop
    aiLoop = setInterval(runAI, 50);
  },

  // Movement loop (60fps): integrates the player's velocity AND glides the
  // opponent toward the player, so both fighters move at the same smooth rate.
  // The AI loop only makes decisions (attack / jump); it no longer nudges the
  // opponent at 20fps, which used to look laggy behind a 0.2s CSS transition.
  playerPhysics: () => {
    // Never run two physics loops at once.
    if (physicsLoop) clearInterval(physicsLoop);
    physicsLoop = setInterval(() => {
      const s = useGameStore.getState();
      // Paused: hold still, keeping the loop alive until resumed.
      if (s.gameStatus === 'paused') return;
      if (s.gameStatus !== 'playing') {
        if (physicsLoop) { clearInterval(physicsLoop); physicsLoop = undefined; }
        return;
      }

      // Player velocity: ease toward input, coast with friction, stop at walls.
      const target = s.moveDir * PLAYER_MAX_SPEED;
      let vel = s.moveDir !== 0
        ? s.playerVel + (target - s.playerVel) * PLAYER_ACCEL
        : s.playerVel * (s.playerY > 0 ? AIR_FRICTION : PLAYER_FRICTION);
      if (Math.abs(vel) < 0.02) vel = 0;

      let pos = s.playerPosition + vel;
      if (pos <= POS_MIN) { pos = POS_MIN; vel = 0; }
      if (pos >= POS_MAX) { pos = POS_MAX; vel = 0; }

      // Fighters are solid on the ground: walking into the opponent pushes
      // up against them. While either one is in the air they can pass, so a
      // jump carries the player over to the other side. Any overlap left on
      // landing is pushed apart on whichever side of the opponent's centre
      // the player came down on — short of the centre, you didn't make it.
      let oppPos = s.opponentPosition;
      const airborne = s.playerY > CLEAR_HEIGHT || s.opponentY > CLEAR_HEIGHT;
      if (!airborne && Math.abs(pos - oppPos) < MIN_SEPARATION) {
        const side = Math.sign(pos - oppPos) || (s.playerPosition <= oppPos ? -1 : 1);
        pos = oppPos + side * MIN_SEPARATION;
        // Pinned against a wall: shove the opponent out instead.
        if (pos < POS_MIN || pos > POS_MAX) {
          pos = Math.max(POS_MIN, Math.min(POS_MAX, pos));
          oppPos = pos - side * MIN_SEPARATION;
        }
      }

      // Opponent: mid cross-up it drifts over the player toward its landing
      // spot; otherwise it approaches at the same 60fps cadence (moveSpeed is
      // tuned per 50ms, so scale it down to this tick).
      if (oppCross) {
        const d = oppCross.target - oppPos;
        oppPos = Math.max(POS_MIN, Math.min(POS_MAX, oppPos + Math.sign(d) * Math.min(Math.abs(d), oppCross.step)));
      } else if (Math.abs(pos - oppPos) > HIT_RANGE) {
        const diff = difficultyForStage(s.gauntletStage + DIFF_OFFSET[s.difficulty]);
        const oppStep = diff.moveSpeed * (MOVE_TICK_MS / 50);
        oppPos = pos < oppPos
          ? Math.max(POS_MIN, oppPos - oppStep)
          : Math.min(POS_MAX, oppPos + oppStep);
      }

      const playerChanged = pos !== s.playerPosition || vel !== s.playerVel;
      const oppChanged = oppPos !== s.opponentPosition;
      if (!playerChanged && !oppChanged) return; // idle — no re-render

      const patch: Partial<GameState> & { playerVel?: number } = {};
      if (playerChanged) {
        patch.playerPosition = pos;
        patch.playerVel = vel;
        if (s.moveDir < -0.05) patch.playerFacing = 'left';
        else if (s.moveDir > 0.05) patch.playerFacing = 'right';
      }
      if (oppChanged) patch.opponentPosition = oppPos;
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
        // Paused: hold still, keeping the loop alive until resumed.
        if (s.gameStatus === 'paused') return;
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

    // Stop the round timer/countdown/AI/physics immediately.
    clearRoundLoops();

    const baseHealth = state.selectedCharacter?.health || 100;
    const opponentBaseHealth = state.opponent?.health || 100;

    // Update wins
    const playerWins = state.playerWins + (winner === 'player' ? 1 : 0);
    const opponentWins = state.opponentWins + (winner === 'opponent' ? 1 : 0);
    const boutOver = playerWins >= 2 || opponentWins >= 2;

    // Enter the KO beat: freeze the arena on the knockout (positions/health as
    // they landed), mark the loser so the UI can play a defeat animation, and
    // cut off any lingering input/attack state.
    set({
      playerWins,
      opponentWins,
      gameStatus: 'roundEnd',
      roundLoser: winner === 'player' ? 'opponent' : 'player',
      isAttacking: false,
      isOpponentAttacking: false,
      currentMove: null,
      opponentMove: null,
      opponentBlocking: false,
      moveDir: 0,
      playerVel: 0,
      isJumping: false
    });

    // After the beat, either roll into the next round or show the bout result.
    roundEndTimeout = setTimeout(() => {
      roundEndTimeout = undefined;
      const common = {
        roundLoser: null as 'player' | 'opponent' | null,
        playerPosition: 15,
        playerY: 0,
        opponentPosition: 65,
        opponentY: 0,
        isJumping: false,
        isAttacking: false,
        isOpponentAttacking: false,
        currentMove: null,
        playerFacing: 'right' as const,
        moveDir: 0,
        playerVel: 0,
        specialMeter: 0,
        opponentSpecialMeter: 0
      };

      if (boutOver) {
        const isFinalStage = state.gauntletStage >= state.gauntletOpponents.length - 1;
        // Player loss ends the run; a win either clears the stage or wins it all.
        const gameStatus = opponentWins >= 2 ? 'lost' : isFinalStage ? 'champion' : 'won';
        // The match is over — leave the loser knocked down where they fell
        // (keep roundLoser + positions), just clear the transient combat state.
        set({
          gameStatus,
          playerY: 0,
          opponentY: 0,
          isJumping: false,
          isAttacking: false,
          isOpponentAttacking: false,
          currentMove: null,
          moveDir: 0,
          playerVel: 0,
          specialMeter: 0,
          opponentSpecialMeter: 0
        });
      } else {
        set({
          round: state.round + 1,
          gameStatus: 'ready',
          countdown: 3,
          timer: 99,
          playerHealth: baseHealth,
          opponentHealth: opponentBaseHealth,
          ...common
        });
        useGameStore.getState().startCountdown();
      }
    }, KO_DURATION);
  },

  resetGame: () => {
    clearRoundLoops();
    set({
      playerHealth: 100,
      opponentHealth: 100,
      gameStatus: 'ready',
      round: 1,
      roundLoser: null,
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
      specialMeter: 0,
      opponentSpecialMeter: 0,
      opponentBlocking: false
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
