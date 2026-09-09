import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import UIFx from 'uifx';
import { useGameStore } from '../store/gameStore';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { stages } from '../data/stages';

export default function GameArena() {
  const navigate = useNavigate();
  const punchSound = useRef<UIFx>();
  const kickSound = useRef<UIFx>();
  const specialSound = useRef<UIFx>();
  const winSound = useRef<UIFx>();
  const loseSound = useRef<UIFx>();

  useEffect(() => {
    // Initialize sounds after component mounts
    punchSound.current = new UIFx('./assets/punch.mp3', { volume: 0.5 });
    kickSound.current = new UIFx('./assets/kick.mp3', { volume: 0.5 });
    specialSound.current = new UIFx('./assets/special.mp3', { volume: 0.6 });
    winSound.current = new UIFx('./assets/victory.mp3', { volume: 0.7 });
    loseSound.current = new UIFx('./assets/defeat.mp3', { volume: 0.7 });
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
    isOpponentAttacking
  } = useGameStore();

  const stage = stages.find(s => s.id === currentStage);

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
    const bgm = new Audio('/assets/fight-bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.3;
    bgm.play().catch(() => {});
    
    startCountdown();

    return () => {
      bgm.pause();
      bgm.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    if (gameStatus === 'won') {
      ReactGA.event({
        category: 'Game',
        action: 'Game Won',
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
          break;
        case 'k':
          performMove('kick');
          break;
        case 'l':
          performMove('special');
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
        {/* Timer and Round */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">
          <div className="text-lg text-yellow-400">
            {timer}
          </div>
          <div className="text-md text-white">
            Round {round}
          </div>
        </div>
        
        {/* Floor */}
        <div className={`absolute bottom-0 w-full h-48 ${stage?.floorColor}`} />
        
        <div className="relative flex items-end justify-around w-full max-w-4xl mx-auto">
          <motion.div
            className="text-[8rem] lg:text-[12rem] transform scale-x-[-1] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] absolute"
            style={{
              left: `${playerPosition}%`,
              bottom: `${playerY}px`,
              transition: 'left 0.2s ease-out, bottom 0.3s ease-out'
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
            className="text-[8rem] lg:text-[12rem] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] absolute"
            style={{
              left: `${opponentPosition}%`,
              transition: 'left 0.2s ease-out'
            }}
            animate={getOpponentAnimation()}
            transition={{
              duration: 0.6,
              ease: "backOut"
            }}
          >
            {opponent.emoji}
          </motion.div>
        </div>
      </div>

      {/* Game Status Overlay */}
      {(gameStatus === 'ready' || gameStatus === 'paused' || gameStatus === 'won' || gameStatus === 'lost') && (
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
            {(gameStatus === 'won' || gameStatus === 'lost') && (
              <h2 className="flex flex-col text-4xl mb-4">
                <motion.span
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-6xl font-bold ${gameStatus === 'won' ? 'text-yellow-400' : 'text-red-500'}`}
                >
                  {gameStatus === 'won' ? 'YOU WIN!' : 'YOU LOSE'}
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-2xl mt-4 text-gray-300"
                >
                  {playerWins === 2 || opponentWins === 2 ? 'Match Complete!' : 'Get Ready for Next Round'}
                </motion.span>
              </h2>
            )}
            <div className="flex flex-col gap-4 justify-center">
              {gameStatus === 'paused' ? (
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
              ) : ((gameStatus === 'won' || gameStatus === 'lost') && (playerWins === 2 || opponentWins === 2)) && (
                <button
                  onClick={() => {
                    resetGame();
                    navigate('/select');
                  }}
                  className="px-6 py-3 bg-yellow-500 text-black rounded-lg flex justify-center items-center gap-2"
                >
                  <RotateCcw size={20} />
                  Play Again
                </button>
              )}
             
            </div>            
          </div>
           <footer className="footer">
        Copyright Edge Kase Inc 2025. All Rights Reserved.
      </footer>
        </div>
      )}

      {/* Controls */}
      <div className="game-controls lg:hidden">
        {/* Movement Controls */}
        <div className="flex gap-4">
          <button onClick={() => performMove('left')} className="move-button">←</button>
          <button onClick={() => performMove('jump')} className="move-button">↑</button>
          <button onClick={() => performMove('right')} className="move-button">→</button>
        </div>

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
    </div>
  );
}