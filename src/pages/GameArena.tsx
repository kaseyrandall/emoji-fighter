import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import UIFx from 'uifx';
import { useGameStore, JUMP_PEAK } from '../store/gameStore';
import { Pause, Play, RotateCcw, Swords, Info } from 'lucide-react';
import { stages } from '../data/stages';
import Joystick from '../components/Joystick';
import Credits from '../components/Credits';

// The store animates a jump to a fixed peak (see JUMP_PEAK in gameStore). On a
// short landscape phone that arc carries the fighter off the top of the screen,
// so the arena scales it to the headroom it actually has. playerY is purely
// presentational — nothing in hit detection reads it — so scaling only changes
// how high the jump looks, never whether an attack lands.

// Breathing room kept between the top of the fighter's head and the top of the
// screen at the peak of a jump.
const JUMP_CEILING_GAP = 8;

interface FloatingHit {
  id: number;
  amount: number;
  target: 'player' | 'opponent';
  x: number;
  special: boolean;
}

export default function GameArena() {
  const navigate = useNavigate();
  const punchSound = useRef<UIFx>();
  const kickSound = useRef<UIFx>();
  const specialSound = useRef<UIFx>();
  const winSound = useRef<UIFx>();
  const loseSound = useRef<UIFx>();

  useEffect(() => {
    // Initialize sounds after component mounts
    punchSound.current = new UIFx('./assets/punch.wav', { volume: 0.5 });
    kickSound.current = new UIFx('./assets/kick.wav', { volume: 0.5 });
    specialSound.current = new UIFx('./assets/special.wav', { volume: 0.6 });
    winSound.current = new UIFx('./assets/victory.wav', { volume: 0.7 });
    loseSound.current = new UIFx('./assets/defeat.wav', { volume: 0.7 });
  }, []);
  
  const {
    selectedCharacter,
    opponent,
    playerHealth,
    opponentHealth,
    gameStatus,
    countdown,
    performMove,
    resetGame,
    togglePause,
    pauseGame,
    resumeGame,
    isAttacking,
    currentMove,
    currentStage,
    startCountdown,
    timer,
    round,
    roundLoser,
    playerWins,
    opponentWins,
    playerPosition,
    playerY,
    opponentPosition,
    opponentY,
    isOpponentAttacking,
    hitEvent,
    gauntletStage,
    gauntletOpponents,
    advanceGauntlet,
    playerFacing,
    setMoveDir,
    performSpecial,
    specialMeter
  } = useGameStore();

  // Super meter: charged by landing punches/kicks; the special fires only when full.
  const specialReady = specialMeter >= 100;
  // The charged aura / glow should only pulse during live play — not linger on
  // the pause, KO or result screens.
  const chargedGlow = specialReady && gameStatus === 'playing';
  const useSpecial = () => {
    const s = useGameStore.getState();
    if (s.gameStatus === 'playing' && s.specialMeter >= 100) {
      performSpecial();
      playMoveSound('special');
    }
  };

  const stage = stages.find(s => s.id === currentStage);
  const nextOpponent = gauntletOpponents[gauntletStage + 1];

  // --- Hit VFX: screen shake, red flash, floating damage numbers ---
  const arenaControls = useAnimationControls();
  const [floatingHits, setFloatingHits] = useState<FloatingHit[]>([]);
  const [flash, setFlash] = useState<'player' | 'opponent' | null>(null);
  // Special-cast VFX: an expanding shockwave at the player + a brief screen flash.
  const [specialBurst, setSpecialBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const [castFlash, setCastFlash] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const lastHitSeq = useRef<number>(0);
  const hitTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const arenaRef = useRef<HTMLDivElement>(null);
  const fighterRef = useRef<HTMLDivElement>(null);
  const [jumpScale, setJumpScale] = useState(1);

  // Measure how far the fighter can rise before leaving the screen. The ceiling
  // is the top of the viewport, not the underside of the HUD: at the top of a
  // big jump the head passes behind the health bars for a moment, which reads
  // fine and leaves the arc nearly intact. Holding it below the HUD instead
  // would cap a 375px-tall phone at ~75px, which is a hop, not a jump.
  React.useLayoutEffect(() => {
    const arena = arenaRef.current;
    const fighter = fighterRef.current;
    if (!arena || !fighter) return;

    const measure = () => {
      // Skip until both boxes are laid out, otherwise we'd latch a scale
      // derived from a zero height and the jump would flatten.
      if (!arena.clientHeight || !fighter.offsetHeight) return;
      const cs = getComputedStyle(arena);
      // Resting top of the fighter, derived from the arena box and the
      // fighter's own height — both independent of its current jump offset, so
      // a resize or rotation mid-jump still measures the resting geometry.
      const restTop =
        arena.getBoundingClientRect().bottom -
        parseFloat(cs.paddingBottom) -
        fighter.offsetHeight;
      const headroom = restTop - JUMP_CEILING_GAP;
      setJumpScale(Math.max(0, Math.min(1, headroom / JUMP_PEAK)));
    };

    // Observing both boxes re-measures when either settles — the emoji resizes
    // at the sm/lg breakpoints and once its font loads, and the observer fires
    // on observe(), so the first reading is taken after layout rather than
    // during it.
    const ro = new ResizeObserver(measure);
    ro.observe(arena);
    ro.observe(fighter);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [gameStatus, selectedCharacter?.emoji]);

  useEffect(() => {
    if (!hitEvent) return;
    // Process each hit exactly once (StrictMode double-invokes effects in dev,
    // which would otherwise re-add an already-exiting number with the same key).
    if (hitEvent.seq === lastHitSeq.current) return;
    lastHitSeq.current = hitEvent.seq;
    const special = hitEvent.move === 'special';

    // Screen shake, bigger on specials
    const mag = special ? 14 : 7;
    arenaControls.start({
      x: [0, -mag, mag, -mag / 2, mag / 2, 0],
      transition: { duration: special ? 0.4 : 0.25 }
    });

    // Red flash on the struck fighter. Clear only if this same flash is still
    // showing, so a newer hit on the other fighter isn't wiped early.
    const target = hitEvent.target;
    setFlash(target);
    const flashTimer = setTimeout(() => setFlash(f => (f === target ? null : f)), 150);

    // Floating damage number on the struck fighter — keep only the latest per
    // fighter so rapid hits replace rather than pile up into an unreadable smear.
    const x = target === 'player' ? playerPosition : opponentPosition;
    const fh: FloatingHit = { id: hitEvent.seq, amount: hitEvent.amount, target, x, special };
    setFloatingHits(prev => [...prev.filter(h => h.target !== fh.target), fh]);
    // Each number removes itself by id. Crucially this timer is NOT cleared when
    // the next hit lands: a following hit on the OTHER fighter would otherwise
    // cancel this removal and leave the number stuck on screen across rounds.
    const numTimer = setTimeout(() => {
      setFloatingHits(prev => prev.filter(h => h.id !== fh.id));
    }, 550);
    hitTimers.current.push(flashTimer, numTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitEvent?.seq]);

  // Clear any pending hit timers on unmount, and wipe leftover VFX whenever a
  // fresh round or match begins so nothing carries over.
  useEffect(() => () => { hitTimers.current.forEach(clearTimeout); hitTimers.current = []; }, []);
  useEffect(() => {
    if (gameStatus === 'intro' || gameStatus === 'ready') {
      setFloatingHits([]);
      setFlash(null);
      setCastFlash(false);
      setSpecialBurst(null);
    }
  }, [gameStatus]);

  // Fire the special-cast burst when the player launches a special. Timers are
  // NOT cancelled on re-run (currentMove flips back to null at 600ms), so the
  // flash/burst always clear themselves instead of lingering on screen.
  useEffect(() => {
    if (currentMove !== 'special') return;
    const s = useGameStore.getState();
    const id = Date.now();
    setSpecialBurst({ id, x: s.playerPosition, y: s.playerY * jumpScale });
    setCastFlash(true);
    hitTimers.current.push(
      setTimeout(() => setCastFlash(false), 220),
      setTimeout(() => setSpecialBurst(b => (b && b.id === id ? null : b)), 800)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMove]);

  const getPlayerAnimation = () => {
    // Face the last-moved direction: default facing "right" is the flipped emoji.
    const facX = playerFacing === 'right' ? -1 : 1;

    // KO beat: the loser topples, the winner does a little victory hop.
    if (gameStatus === 'roundEnd') {
      if (roundLoser === 'player') {
        return { scaleX: facX, rotate: -78, y: 28, opacity: 0.7, transition: { duration: 0.5, ease: 'backOut' } };
      }
      return { scaleX: facX, y: [0, -20, 0], transition: { duration: 0.5, repeat: 2, ease: 'easeOut' } };
    }

    // Explicitly reset rotate/y/opacity here: once the KO pose sets them, an
    // animation target that omits them would leave the fighter stuck toppled.
    if (!isAttacking) return { scaleX: facX, rotate: 0, y: 0, opacity: 1 };

    const duration = 0.4;

    switch (currentMove) {
      case 'punch':
        return {
          scaleX: facX,
          rotate: [0, -15, 0],
          y: 0,
          opacity: 1,
          transition: { duration }
        };
      case 'kick':
        return {
          scaleX: facX,
          rotate: [0, 45, 0],
          y: 0,
          opacity: 1,
          transition: { duration }
        };
      case 'special':
        return {
          scaleX: facX,
          scaleY: [1, 1.2, 1],
          rotate: [0, 45, 0],
          y: 0,
          opacity: 1,
          transition: { duration: 0.6 }
        };
      default:
        return { scaleX: facX, rotate: 0, y: 0, opacity: 1 };
    }
  };

  const getOpponentAnimation = () => {
    // KO beat: the loser topples, the winner does a little victory hop.
    if (gameStatus === 'roundEnd') {
      if (roundLoser === 'opponent') {
        return { rotate: 78, y: 28, opacity: 0.7, transition: { duration: 0.5, ease: 'backOut' } };
      }
      return { y: [0, -20, 0], transition: { duration: 0.5, repeat: 2, ease: 'easeOut' } };
    }

    // Reset rotate/y/opacity so a fighter that toppled on a KO stands back up
    // for the next round / match instead of staying rotated.
    if (!isOpponentAttacking) return { rotate: 0, y: 0, opacity: 1 };

    return {
      rotate: [0, -20, 0],
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 }
    };
  };

  useEffect(() => {
    if (!selectedCharacter || !opponent) {
      navigate('/select');
      return;
    }

    // Play background music
    const bgm = new Audio('/assets/fight-bgm.wav');
    bgm.loop = true;
    bgm.volume = 0.3;
    bgm.play().catch(() => {});

    return () => {
      bgm.pause();
      bgm.currentTime = 0;
    };
  }, []);

  // Each bout opens on the VS intro screen, then rolls into the countdown.
  useEffect(() => {
    if (gameStatus !== 'intro') return;
    const t = setTimeout(() => startCountdown(), 2200);
    return () => clearTimeout(t);
  }, [gameStatus, gauntletStage]);

  useEffect(() => {
    if (gameStatus === 'won' || gameStatus === 'champion') {
      ReactGA.event({
        category: 'Game',
        action: gameStatus === 'champion' ? 'Gauntlet Cleared' : 'Stage Cleared',
        label: `${selectedCharacter?.name} vs ${opponent?.name}`
      });
      winSound.current?.play();
    } else if (gameStatus === 'lost') {
      ReactGA.event({
        category: 'Game',
        action: 'Game Lost',
        label: `${selectedCharacter?.name} vs ${opponent?.name}`
      });
      loseSound.current?.play();
    }
  }, [gameStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;

      switch (e.key.toLowerCase()) {
        case 'j':
          performMove('punch');
          playMoveSound('punch');
          break;
        case 'k':
          performMove('kick');
          playMoveSound('kick');
          break;
        case 'l':
          useSpecial();
          break;
        case 'a':
          setMoveDir(-1);
          break;
        case 'd':
          setMoveDir(1);
          break;
        case 'w':
          performMove('jump');
          break;
        case ' ':
          togglePause();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'd') setMoveDir(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStatus]);

  const playMoveSound = (move: string) => {
    switch (move) {
      case 'punch':
        ReactGA.event({
          category: 'Game',
          action: 'Move Used',
          label: 'Punch'
        });
        punchSound.current?.play();
        break;
      case 'kick':
        ReactGA.event({
          category: 'Game',
          action: 'Move Used',
          label: 'Kick'
        });
        kickSound.current?.play();
        break;
      case 'special':
        ReactGA.event({
          category: 'Game',
          action: 'Move Used',
          label: `${selectedCharacter?.specialName}`
        });
        specialSound.current?.play();
        break;
    }
  };

  if (!selectedCharacter || !opponent) return null;

  return (
    <div className="relative h-[100dvh] flex flex-col items-center justify-between overflow-hidden">
      {/* Stage Background */}
      <div 
        className="absolute inset-0 bg-black bg-cover bg-center"
        style={{ backgroundImage: `url(${stage?.background})` }}
      >
      </div>
      
      {/* Ambient Light Overlay */}
      <div className={`absolute inset-0 ${stage?.ambientLight} mix-blend-overlay`} />
      
      {/* Top HUD — corner portraits, full-width health bars meeting a central
          round/timer badge (MK-style). */}
      <div className="hud-text relative w-full max-w-5xl mx-auto flex items-start gap-1.5 sm:gap-3 px-2 sm:px-3 pt-2 z-10">
        {/* Player portrait */}
        <div
          className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center text-2xl sm:text-4xl bg-gray-900/60 backdrop-blur-sm transition-colors"
          style={{ border: `2px solid ${specialReady ? '#d8b4fe' : 'rgba(34,197,94,0.7)'}` }}
        >
          {selectedCharacter.emoji}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="truncate text-[10px] sm:text-xs font-semibold">{selectedCharacter.name}</span>
            <div className="flex gap-0.5 shrink-0 ml-auto">
              {[0, 1].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < playerWins ? '#fbbf24' : 'rgba(255,255,255,0.25)' }} />
              ))}
            </div>
          </div>
          <div className="h-2.5 sm:h-3.5 bg-gray-800/80 rounded-full overflow-hidden border border-black/40">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300" style={{ width: `${playerHealth}%` }} />
          </div>
          {/* super meter (charged by landing attacks) */}
          <div className="mt-1 h-1.5 bg-gray-800/70 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${specialMeter}%`,
                background: specialReady ? '#e9d5ff' : 'linear-gradient(90deg,#7c3aed,#c084fc)',
                boxShadow: specialReady ? '0 0 8px rgba(216,180,254,0.9)' : undefined,
              }}
            />
          </div>
        </div>

        {/* Central round / timer badge */}
        <div className="shrink-0 flex flex-col items-center -mt-0.5">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gray-900/70 border-2 border-yellow-500/80 flex items-center justify-center text-yellow-400 text-sm sm:text-xl font-bold tabular-nums shadow-[0_0_12px_rgba(234,179,8,0.4)]">
            {timer}
          </div>
          <div className="text-[8px] sm:text-[9px] text-white/95 mt-0.5 tracking-wide uppercase leading-none">Round {round}</div>
          {gauntletOpponents.length > 0 && (
            <div className="text-[7px] sm:text-[8px] text-orange-200 leading-none mt-0.5">{gauntletStage + 1}/{gauntletOpponents.length}</div>
          )}
          {gameStatus === 'playing' && (
            <button
              onClick={pauseGame}
              className="mt-1 w-6 h-6 bg-gray-700/60 rounded-md hover:bg-gray-600/60 flex items-center justify-center backdrop-blur-sm"
              aria-label="Pause"
            >
              <Pause size={13} />
            </button>
          )}
        </div>

        {/* Opponent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <div className="flex gap-0.5 shrink-0">
              {[0, 1].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < opponentWins ? '#fbbf24' : 'rgba(255,255,255,0.25)' }} />
              ))}
            </div>
            <span className="truncate text-[10px] sm:text-xs font-semibold text-right ml-auto">{opponent.name}</span>
          </div>
          <div className="h-2.5 sm:h-3.5 bg-gray-800/80 rounded-full overflow-hidden border border-black/40 flex justify-end">
            <div className="h-full bg-gradient-to-l from-red-400 to-red-500 transition-all duration-300" style={{ width: `${opponentHealth}%` }} />
          </div>
        </div>

        {/* Opponent portrait */}
        <div className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center text-2xl sm:text-4xl bg-gray-900/60 backdrop-blur-sm border-2 border-red-500/70">
          {opponent.emoji}
        </div>
      </div>

      {/* Arena — the bottom inset sets the fighters' ground line. It keeps them
          standing back on the stage floor instead of at its front lip, and on
          touch layouts it lifts them clear of the joystick and attack pads. */}
      <div ref={arenaRef} className="relative flex-1 w-full flex flex-col justify-end pb-10 lg:pb-16">
        {/* Floor */}
        <div className={`absolute bottom-0 w-full h-48 ${stage?.floorColor}`} />
        
        <motion.div
          className="relative flex items-end justify-around w-full max-w-4xl mx-auto"
          animate={arenaControls}
        >
          {/* Floating damage numbers — centered over the struck fighter, kept clear of the top HUD */}
          <AnimatePresence>
            {floatingHits.map(h => (
              <motion.div
                key={h.id}
                className={`absolute pointer-events-none font-arcade font-bold z-20 ${
                  h.special ? 'text-yellow-300 text-lg lg:text-4xl' : 'text-red-500 text-base lg:text-3xl'
                } drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]`}
                style={{ left: `${h.x}%`, bottom: '90px', x: '-50%' }}
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: 1, y: -25, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                -{h.amount}
              </motion.div>
            ))}
          </AnimatePresence>

          <motion.div
            ref={fighterRef}
            className="text-[5.5rem] sm:text-[6.5rem] lg:text-[9rem] absolute"
            style={{
              left: `${playerPosition}%`,
              bottom: `${playerY * jumpScale}px`,
              transition: 'bottom 0.08s linear',
              filter: flash === 'player'
                ? 'brightness(1.9) drop-shadow(0 0 22px rgba(255,40,40,0.95))'
                : chargedGlow
                ? 'drop-shadow(0 0 22px rgba(216,180,254,0.9))'
                : 'drop-shadow(0 0 15px rgba(255,255,255,0.5))'
            }}
            animate={getPlayerAnimation()}
            transition={{
              duration: 0.25,
              ease: currentMove === 'special' ? "backOut" : "easeInOut"
            }}
          >
            {/* Charged aura — a pulsing halo while the super meter is full. */}
            {chargedGlow && (
              <>
                <motion.span
                  className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                  style={{ width: '1.15em', height: '1.15em', x: '-50%', y: '-50%',
                    background: 'radial-gradient(circle, rgba(216,180,254,0.55), rgba(168,85,247,0.15) 55%, transparent 72%)' }}
                  animate={{ scale: [1, 1.28, 1], opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute left-1/2 top-1/2 text-[0.22em] pointer-events-none"
                    style={{ x: '-50%', y: '-50%' }}
                    animate={{
                      rotate: [i * 120, i * 120 + 360],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                  >
                    <span className="inline-block" style={{ transform: 'translateY(-0.75em)' }}>✨</span>
                  </motion.span>
                ))}
              </>
            )}
            {selectedCharacter.emoji}
          </motion.div>
          <motion.div
            className="text-[5.5rem] sm:text-[6.5rem] lg:text-[9rem] absolute"
            style={{
              left: `${opponentPosition}%`,
              bottom: `${opponentY * jumpScale}px`,
              transition: 'left 0.2s ease-out, bottom 0.08s linear',
              filter: flash === 'opponent'
                ? 'brightness(1.9) drop-shadow(0 0 22px rgba(255,40,40,0.95))'
                : 'drop-shadow(0 0 15px rgba(255,255,255,0.5))'
            }}
            animate={getOpponentAnimation()}
            transition={{
              duration: 0.6,
              ease: "backOut"
            }}
          >
            {opponent.emoji}
          </motion.div>

          {/* Special-cast shockwave + sparkle burst at the player. */}
          <AnimatePresence>
            {specialBurst && (
              <div
                key={specialBurst.id}
                className="absolute pointer-events-none z-10"
                style={{ left: `${specialBurst.x}%`, bottom: `${specialBurst.y + 44}px`, transform: 'translateX(-10%)' }}
              >
                {/* expanding rings */}
                {[0, 1].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute rounded-full"
                    style={{ left: 0, top: 0, x: '-50%', y: '-50%', border: '3px solid rgba(216,180,254,0.9)' }}
                    initial={{ width: 12, height: 12, opacity: 0.9 }}
                    animate={{ width: 150 + i * 60, height: 150 + i * 60, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut', delay: i * 0.08 }}
                  />
                ))}
                {/* core flash */}
                <motion.span
                  className="absolute rounded-full"
                  style={{ left: 0, top: 0, x: '-50%', y: '-50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(216,180,254,0.6) 45%, transparent 70%)' }}
                  initial={{ width: 70, height: 70, opacity: 0.95 }}
                  animate={{ width: 20, height: 20, opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
                {/* sparkle particles flying outward */}
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <motion.span
                    key={deg}
                    className="absolute text-xl lg:text-2xl"
                    style={{ left: 0, top: 0 }}
                    initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 0.6 }}
                    animate={{
                      x: `calc(-50% + ${Math.cos((deg * Math.PI) / 180) * 70}px)`,
                      y: `calc(-50% + ${Math.sin((deg * Math.PI) / 180) * 70}px)`,
                      opacity: 0,
                      scale: 1.1,
                    }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  >
                    ✨
                  </motion.span>
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Brief purple wash when a special is cast. */}
      <AnimatePresence>
        {castFlash && gameStatus === 'playing' && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-30"
            style={{ background: 'radial-gradient(circle at 50% 60%, rgba(216,180,254,0.35), transparent 65%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>

      {/* KO beat between a round ending and the next round / result screen. */}
      {gameStatus === 'roundEnd' && (
        <div className="fixed inset-0 pointer-events-none z-30 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.3, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 13 }}
            className="font-arcade text-5xl sm:text-7xl text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,0.75)] tracking-widest"
          >
            K.O.
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mt-2 text-white text-sm sm:text-lg font-bold text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
          >
            {(roundLoser === 'player' ? opponent.name : selectedCharacter.name)} wins Round {round}
          </motion.div>
        </div>
      )}

      {/* VS intro / loading screen shown before each gauntlet bout */}
      {gameStatus === 'intro' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center z-20 px-4">
          {gauntletOpponents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-arcade text-orange-400 text-sm lg:text-xl mb-6 lg:mb-10 tracking-wide"
            >
              FIGHT {gauntletStage + 1} <span className="text-gray-500">/</span> {gauntletOpponents.length}
            </motion.div>
          )}
          <div className="flex items-center justify-center gap-4 lg:gap-10 w-full max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="flex flex-col items-center gap-1 flex-1 min-w-0"
            >
              <span className="text-6xl lg:text-8xl leading-none">{selectedCharacter.emoji}</span>
              <span className="font-bold text-sm lg:text-2xl text-center leading-tight">{selectedCharacter.name}</span>
              <span className="text-[10px] lg:text-sm text-yellow-400 text-center leading-tight">{selectedCharacter.specialName}</span>
            </motion.div>

            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}
              className="font-arcade text-3xl lg:text-6xl text-red-500 drop-shadow-[0_0_14px_rgba(255,0,0,0.6)] shrink-0"
            >
              VS
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="flex flex-col items-center gap-1 flex-1 min-w-0"
            >
              <span className="text-6xl lg:text-8xl leading-none">{opponent.emoji}</span>
              <span className="font-bold text-sm lg:text-2xl text-center leading-tight">{opponent.name}</span>
              <span className="text-[10px] lg:text-sm text-yellow-400 text-center leading-tight">{opponent.specialName}</span>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 lg:mt-10 text-gray-400 text-[11px] lg:text-base"
          >
            Get ready…
          </motion.div>
        </div>
      )}

      {/* Game Status Overlay */}
      {(gameStatus === 'ready' || gameStatus === 'paused' || gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'champion') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="text-center relative">
            {gameStatus === 'ready' && countdown > 0 && (
              <motion.h2
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl mb-4 text-yellow-400 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]"
              >
                {countdown}
              </motion.h2>
            )}
            {gameStatus === 'ready' && countdown === 0 && (
              <motion.h2
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="text-6xl mb-4 text-red-500 drop-shadow-[0_2px_8px_rgba(255,0,0,0.5)]"
              >
                FIGHT!
              </motion.h2>
            )}
            {gameStatus === 'paused' && (
              <h2 className="text-4xl mb-4 text-white">PAUSED</h2>
            )}
            {(gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'champion') && (
              <h2 className="flex flex-col mb-4">
                <motion.span
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-4xl lg:text-6xl font-bold ${
                    gameStatus === 'lost' ? 'text-red-500' : 'text-yellow-400'
                  }`}
                >
                  {gameStatus === 'champion' ? 'CHAMPION!' : gameStatus === 'won' ? 'STAGE CLEARED' : 'DEFEATED'}
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-base lg:text-2xl mt-2 lg:mt-4 text-gray-300"
                >
                  {gameStatus === 'champion'
                    ? `You conquered all ${gauntletOpponents.length} fights!`
                    : gameStatus === 'won'
                    ? nextOpponent
                      ? `Next up: ${nextOpponent.name} ${nextOpponent.emoji}`
                      : 'On to the next!'
                    : `You reached Fight ${gauntletStage + 1} / ${gauntletOpponents.length}`}
                </motion.span>
              </h2>
            )}
            <div className="flex flex-col gap-3 lg:gap-4 justify-center">
              {gameStatus === 'paused' && (
                <>
                  <button
                    onClick={resumeGame}
                    className="px-6 py-3 bg-green-500 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Play size={20} />
                    Resume
                  </button>
                  <button
                    onClick={() => {
                      resetGame();
                      navigate('/select');
                    }}
                    className="px-6 py-3 bg-red-500 rounded-lg flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={20} />
                    Quit
                  </button>
                  <button
                    onClick={() => setShowCredits(true)}
                    className="px-6 py-2 text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <Info size={16} />
                    Credits
                  </button>
                </>
              )}
              {gameStatus === 'won' && (
                <button
                  onClick={() => advanceGauntlet()}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold
                           flex justify-center items-center gap-2 active:brightness-110"
                >
                  <Swords size={20} />
                  Next Fight
                </button>
              )}
              {(gameStatus === 'lost' || gameStatus === 'champion') && (
                <button
                  onClick={() => {
                    resetGame();
                    navigate('/select');
                  }}
                  className="px-6 py-3 bg-yellow-500 text-black rounded-lg font-bold flex justify-center items-center gap-2"
                >
                  <RotateCcw size={20} />
                  {gameStatus === 'champion' ? 'Play Again' : 'Try Again'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls — kept mounted across the round countdown too, so a joystick
          held through a KO doesn't lose the still-down finger on the next round. */}
      {(gameStatus === 'ready' || gameStatus === 'playing') && (
        <div className="game-controls lg:hidden items-end">
          {/* Movement joystick */}
          <Joystick onMoveDir={setMoveDir} onJump={() => performMove('jump')} size={116} />

          {/* Attack cluster — special as a clearly-visible apex above the
              punch/kick primary pair (a triangle, no button hidden behind
              another). */}
          <div className="relative w-[10rem] h-[8.5rem] shrink-0 select-none">
            {/* Special apex — always visible; the ring fills as the super meter
                charges and the whole button glows once it's ready. */}
            <motion.button
              onClick={useSpecial}
              className="game-button absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full flex items-center justify-center text-2xl overflow-hidden focus:outline-none active:brightness-110"
              style={{
                background: 'radial-gradient(circle at 50% 35%, #a855f7, #6b21a8)',
                opacity: specialReady ? 1 : 0.7,
                border: `2px solid ${specialReady ? '#e9d5ff' : 'rgba(216,180,254,0.55)'}`,
                boxShadow: specialReady ? '0 0 22px rgba(216,180,254,0.95)' : '0 0 10px rgba(168,85,247,0.5)',
              }}
              animate={specialReady ? { scale: [1, 1.09, 1] } : { scale: 1 }}
              transition={specialReady ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
              aria-label="Special"
            >
              {/* super meter fill (charged by landing attacks) */}
              <span
                className="absolute inset-x-0 bottom-0 bg-purple-200/70 pointer-events-none transition-[height] duration-200"
                style={{ height: `${specialMeter}%` }}
              />
              <span className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">✨</span>
            </motion.button>

            {/* Punch (primary) */}
            <button
              onClick={() => { performMove('punch'); playMoveSound('punch'); }}
              className="game-button absolute bottom-0 left-0.5 w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center text-3xl bg-red-500/55 border-2 border-red-300/70 focus:outline-none active:bg-red-600/70"
              aria-label="Punch"
            >👊</button>
            {/* Kick (primary) */}
            <button
              onClick={() => { performMove('kick'); playMoveSound('kick'); }}
              className="game-button absolute bottom-0 right-0.5 w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center text-3xl bg-blue-500/55 border-2 border-blue-300/70 focus:outline-none active:bg-blue-600/70"
              aria-label="Kick"
            >🦶</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCredits && <Credits onClose={() => setShowCredits(false)} />}
      </AnimatePresence>
    </div>
  );
}