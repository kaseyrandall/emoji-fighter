import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import UIFx from 'uifx';
import { useGameStore } from '../store/gameStore';
import { Pause, Play, RotateCcw, Swords } from 'lucide-react';
import { stages } from '../data/stages';
import Joystick from '../components/Joystick';

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
    isAttacking,
    currentMove,
    currentStage,
    startCountdown,
    timer,
    round,
    playerWins,
    opponentWins,
    playerPosition,
    playerY,
    opponentPosition,
    isOpponentAttacking,
    hitEvent,
    gauntletStage,
    gauntletOpponents,
    advanceGauntlet
  } = useGameStore();

  const stage = stages.find(s => s.id === currentStage);
  const nextOpponent = gauntletOpponents[gauntletStage + 1];

  // --- Hit VFX: screen shake, red flash, floating damage numbers ---
  const arenaControls = useAnimationControls();
  const [floatingHits, setFloatingHits] = useState<FloatingHit[]>([]);
  const [flash, setFlash] = useState<'player' | 'opponent' | null>(null);
  const lastHitSeq = useRef<number>(0);

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

    // Red flash on the struck fighter
    setFlash(hitEvent.target);
    const flashTimer = setTimeout(() => setFlash(null), 150);

    // Floating damage number on the struck fighter — keep only the latest per
    // fighter so rapid hits replace rather than pile up into an unreadable smear.
    const x = hitEvent.target === 'player' ? playerPosition : opponentPosition;
    const fh: FloatingHit = { id: hitEvent.seq, amount: hitEvent.amount, target: hitEvent.target, x, special };
    setFloatingHits(prev => [...prev.filter(h => h.target !== fh.target), fh]);
    const numTimer = setTimeout(() => {
      setFloatingHits(prev => prev.filter(h => h.id !== fh.id));
    }, 550);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(numTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitEvent?.seq]);

  const getPlayerAnimation = () => {
    if (!isAttacking) return {};
    
    const duration = 0.4;
    
    switch (currentMove) {
      case 'punch':
        return {
          rotate: [0, -15, 0],
          transition: { duration }
        };
      case 'kick':
        return {
          rotate: [0, 45, 0],
          transition: { duration }
        };
      case 'special':
        return {
          scale: [1, 1.2, 1],
          rotate: [0, 45, 0],
          transition: { duration: 0.6 }
        };
      default:
        return {};
    }
  };

  const getOpponentAnimation = () => {
    if (!isOpponentAttacking) return {};
    
    return {
      rotate: [0, -20, 0],
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
    const handleKeyPress = (e: KeyboardEvent) => {
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
          performMove('special');
          playMoveSound('special');
          break;
        case 'a':
          performMove('left');
          break;
        case 'd':
          performMove('right');
          break;
        case 'w':
          performMove('jump');
          break;
        case ' ':
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden">
      {/* Stage Background */}
      <div 
        className="absolute inset-0 bg-black bg-cover bg-center"
        style={{ backgroundImage: `url(${stage?.background})` }}
      >
      </div>
      
      {/* Ambient Light Overlay */}
      <div className={`absolute inset-0 ${stage?.ambientLight} mix-blend-overlay`} />
      
      {/* Health Bars */}
      <div className="relative lg:w-full w-[80%] max-w-4xl flex justify-between gap-4 text-lg pt-4 z-10">
        {/* Pause Button */}
        <button
          onClick={togglePause}
          className="fixed top-4 left-4 w-10 h-10 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 
                   flex items-center justify-center backdrop-blur-sm"
        >
          {gameStatus === 'paused' ? <Play size={20} /> : <Pause size={20} />}
        </button>

        <div className="flex-1">
          <div className="text-yellow-400 font-arcade text-sm mb-2">
            Wins: {playerWins}
          </div>
          <div className="flex justify-between mb-2 text-sm">
            <span>{selectedCharacter.name}</span>
            <span>{playerHealth}%</span>
          </div>
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${playerHealth}%` }}
            />
          </div>
        </div>
        
        <div className="font-arcade text-4xl text-red-500 flex items-center 
                    drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">
          VS
        </div>
        
        <div className="flex-1">
          <div className="text-yellow-400 font-arcade text-sm mb-2 text-right">
            Wins: {opponentWins}
          </div>
          <div className="flex justify-between mb-2 text-sm">
            <span>{opponent.name}</span>
            <span>{opponentHealth}%</span>
          </div>
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${opponentHealth}%` }}
            />
          </div>
        </div>
      </div>

      {/* Arena */}
      <div className="relative flex-1 w-full flex flex-col justify-end pb-8 lg:pb-0">
        {/* Timer, Round, and Gauntlet progress */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">
          <div className="text-lg text-yellow-400">
            {timer}
          </div>
          <div className="text-md text-white">
            Round {round}
          </div>
          {gauntletOpponents.length > 0 && (
            <div className="text-[10px] lg:text-xs text-orange-300 mt-0.5">
              Fight {gauntletStage + 1} / {gauntletOpponents.length}
            </div>
          )}
        </div>
        
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
            className="text-[8rem] lg:text-[12rem] transform scale-x-[-1] absolute"
            style={{
              left: `${playerPosition}%`,
              bottom: `${playerY}px`,
              transition: 'left 0.2s ease-out, bottom 0.3s ease-out',
              filter: flash === 'player'
                ? 'brightness(1.9) drop-shadow(0 0 22px rgba(255,40,40,0.95))'
                : 'drop-shadow(0 0 15px rgba(255,255,255,0.5))'
            }}
            animate={getPlayerAnimation()}
            transition={{
              duration: 0.6,
              ease: currentMove === 'special' ? "backOut" : "easeInOut"
            }}
          >
            {selectedCharacter.emoji}
          </motion.div>
          <motion.div
            className="text-[8rem] lg:text-[12rem] absolute"
            style={{
              left: `${opponentPosition}%`,
              transition: 'left 0.2s ease-out',
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
        </motion.div>
      </div>

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
                    onClick={togglePause}
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

      {/* Controls — only while actively playing, so they never sit under the overlay/footer */}
      {gameStatus === 'playing' && (
        <div className="game-controls lg:hidden">
          {/* Movement joystick */}
          <Joystick onMove={performMove} size={116} />

          {/* Attack Controls */}
          <div className="flex gap-4">
            <button
              onClick={() => { performMove('punch'); playMoveSound('punch'); }}
              className="attack-button punch"
            >👊</button>
            <button
              onClick={() => { performMove('kick'); playMoveSound('kick'); }}
              className="attack-button kick"
            >🦶</button>
            <button
              onClick={() => { performMove('special'); playMoveSound('special'); }}
              className="attack-button special"
            >✨</button>
          </div>
        </div>
      )}
    </div>
  );
}