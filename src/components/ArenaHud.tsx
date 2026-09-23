import React from 'react';
import { Pause } from 'lucide-react';
import { Character } from '../types/game';

interface ArenaHudProps {
  player: Character;
  opponent: Character;
  playerHealth: number;
  opponentHealth: number;
  playerWins: number;
  opponentWins: number;
  specialMeter: number;
  timer: number;
  round: number;
  gauntletStage: number;
  gauntletTotal: number;
  showPause: boolean;
  onPause: () => void;
}

// Top HUD — corner portraits, full-width health bars meeting a central
// round/timer badge (MK-style). Memoized so the ~30 HUD nodes aren't
// reconciled on every 60fps movement frame; it only re-renders when one of
// these values actually changes (a hit, the timer ticking, a round change…).
function ArenaHudBase({
  player,
  opponent,
  playerHealth,
  opponentHealth,
  playerWins,
  opponentWins,
  specialMeter,
  timer,
  round,
  gauntletStage,
  gauntletTotal,
  showPause,
  onPause,
}: ArenaHudProps) {
  const specialReady = specialMeter >= 100;

  return (
    <div className="hud-text relative w-full max-w-5xl mx-auto flex items-start gap-1.5 sm:gap-3 px-2 sm:px-3 pt-2 z-10">
      {/* Player portrait */}
      <div
        className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center text-2xl sm:text-4xl bg-gray-900/60 backdrop-blur-sm transition-colors"
        style={{ border: `2px solid ${specialReady ? '#d8b4fe' : 'rgba(34,197,94,0.7)'}` }}
      >
        {player.emoji}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="truncate text-[10px] sm:text-xs font-semibold">{player.name}</span>
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
        {gauntletTotal > 0 && (
          <div className="text-[7px] sm:text-[8px] text-orange-200 leading-none mt-0.5">{gauntletStage + 1}/{gauntletTotal}</div>
        )}
        {showPause && (
          <button
            onClick={onPause}
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
  );
}

export const ArenaHud = React.memo(ArenaHudBase);
