import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion, AnimatePresence } from 'framer-motion';
import UIFx from 'uifx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { Play, RotateCcw, Swords, Info } from 'lucide-react';
import Joystick from '../components/Joystick';
import Credits from '../components/Credits';
import { ArenaHud } from '../components/ArenaHud';
import ArenaScene from '../three/ArenaScene';
import { specialStyleOf } from '../three/specialStyles';

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

  // Only the values the DOM overlays show. Positions, jumps and hit events
  // change every frame and are read by the 3D scene directly, so subscribing
  // to them here would re-render this whole tree at 60fps.
  const {
    selectedCharacter,
    opponent,
    playerHealth,
    opponentHealth,
    gameStatus,
    countdown,
    currentMove,
    timer,
    round,
    roundLoser,
    playerWins,
    opponentWins,
    gauntletStage,
    gauntletOpponents,
    specialMeter,
  } = useGameStore(
    useShallow((s) => ({
      selectedCharacter: s.selectedCharacter,
      opponent: s.opponent,
      playerHealth: s.playerHealth,
      opponentHealth: s.opponentHealth,
      gameStatus: s.gameStatus,
      countdown: s.countdown,
      currentMove: s.currentMove,
      timer: s.timer,
      round: s.round,
      roundLoser: s.roundLoser,
      playerWins: s.playerWins,
      opponentWins: s.opponentWins,
      gauntletStage: s.gauntletStage,
      gauntletOpponents: s.gauntletOpponents,
      specialMeter: s.specialMeter,
    }))
  );
  // Actions are stable references.
  const { performMove, resetGame, togglePause, pauseGame, resumeGame, startCountdown, advanceGauntlet, setMoveDir, performSpecial } =
    useGameStore.getState();

  // Super meter: charged by landing punches/kicks; the special fires only when full.
  const specialReady = specialMeter >= 100;
  const fireSpecial = () => {
    const s = useGameStore.getState();
    if (s.gameStatus === 'playing' && s.specialMeter >= 100) {
      performSpecial();
      playMoveSound('special');
    }
  };

  const nextOpponent = gauntletOpponents[gauntletStage + 1];

  const [castFlash, setCastFlash] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  // Brief purple wash when the player casts their super (the 3D scene handles
  // the rings / sparks / camera punch-in).
  useEffect(() => {
    if (currentMove !== 'special') return;
    setCastFlash(true);
    const t = setTimeout(() => setCastFlash(false), 220);
    return () => clearTimeout(t);
  }, [currentMove]);

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

  // Auto-pause when the tab/app is backgrounded: stops the loops (saving CPU
  // and battery) and keeps the player from being KO'd while they're away.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) useGameStore.getState().pauseGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
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
          fireSpecial();
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
      {/* The fight itself: a full-screen three.js scene under the DOM HUD. */}
      <div className="absolute inset-0">
        <ArenaScene />
      </div>

      <ArenaHud
        player={selectedCharacter}
        opponent={opponent}
        playerHealth={playerHealth}
        opponentHealth={opponentHealth}
        playerWins={playerWins}
        opponentWins={opponentWins}
        specialMeter={specialMeter}
        timer={timer}
        round={round}
        gauntletStage={gauntletStage}
        gauntletTotal={gauntletOpponents.length}
        showPause={gameStatus === 'playing'}
        onPause={pauseGame}
      />

      {/* Brief wash in the fighter's special colour when they cast it. */}
      <AnimatePresence>
        {castFlash && gameStatus === 'playing' && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-30"
            style={{ background: `radial-gradient(circle at 50% 60%, ${specialStyleOf(selectedCharacter.id).color}66, transparent 65%)` }}
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
        <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/70 flex flex-col items-center justify-center z-20 px-4">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
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
        <div className="game-controls items-end">
          {/* Movement joystick */}
          <Joystick onMoveDir={setMoveDir} onJump={() => performMove('jump')} size={116} />

          {/* Attack cluster — special as a clearly-visible apex above the
              punch/kick primary pair (a triangle, no button hidden behind
              another). */}
          <div className="relative w-[10rem] h-[8.5rem] shrink-0 select-none">
            {/* Special apex — always visible; the ring fills as the super meter
                charges and the whole button glows once it's ready. */}
            <motion.button
              onClick={fireSpecial}
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