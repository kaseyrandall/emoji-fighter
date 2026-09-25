import React from 'react';
import { motion } from 'framer-motion';
import { Info, LogOut, Maximize, Music, Play, Swords, Volume2 } from 'lucide-react';
import { Character } from '../types/game';
import { useSettings } from '../store/settingsStore';
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, onFullscreenChange } from '../lib/fullscreen';

// A settings tile: icon over a label, lit up when on, with a status dot in
// the corner. Big enough to hit with a thumb; the state reads at a glance.
function SettingTile({ label, icon, on, onChange }: { label: string; icon: React.ReactNode; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-full rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors active:scale-95 ${
        on ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-300' : 'border-white/10 bg-white/[0.03] text-gray-500'
      }`}
    >
      <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${on ? 'bg-green-400' : 'bg-gray-600'}`} />
      {icon}
      <span className="text-[11px] lg:text-sm font-semibold whitespace-nowrap">{label}</span>
    </button>
  );
}

interface PauseMenuProps {
  player: Character;
  opponent: Character;
  fight: number;
  totalFights: number;
  round: number;
  onResume: () => void;
  onQuit: () => void;
  onCredits: () => void;
}

// The pause screen: one card with the matchup, a big square Resume, and
// beside it the settings as tap tiles (remembered on the device) over
// Quit / Credits.
export default function PauseMenu({ player, opponent, fight, totalFights, round, onResume, onQuit, onCredits }: PauseMenuProps) {
  const { music, sfx, setMusic, setSfx, setFullscreen } = useSettings();
  // Fullscreen shows the real state: the player can also leave it with the
  // system back / swipe gesture or Esc.
  const [full, setFull] = React.useState(isFullscreen);
  React.useEffect(() => onFullscreenChange(() => setFull(isFullscreen())), []);
  const canFullscreen = fullscreenSupported();
  // Quitting throws away the whole gauntlet run, so it takes a second tap.
  const [confirmQuit, setConfirmQuit] = React.useState(false);

  // Everything is sized off the screen: the card takes a share of the width,
  // row heights a share of the height, and Resume is a square exactly as tall
  // as the two rows beside it.
  const sizes = {
    '--tile': 'clamp(4rem, 17vh, 6.5rem)',
    '--act': 'clamp(3rem, 13vh, 5rem)',
    '--resume': 'calc(var(--tile) + var(--act) + 0.75rem)',
  } as React.CSSProperties;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={sizes}
      className="w-[92vw] md:w-[80vw] max-w-[60rem] rounded-2xl border border-white/10 bg-gray-950/85 backdrop-blur-md shadow-2xl p-4 sm:p-5 lg:p-7 text-left"
    >
      {/* Header: title + where you are in the gauntlet */}
      <div className="flex items-center justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <h2 className="text-lg lg:text-2xl tracking-widest text-white">PAUSED</h2>
          {confirmQuit ? (
            <p className="mt-1.5 text-[10px] lg:text-xs tracking-wider text-red-300 uppercase">
              Quit? This run's progress will be lost
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] lg:text-xs tracking-wider text-gray-400 uppercase">
              Fight {fight}/{totalFights} · Round {round}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-2xl lg:text-4xl shrink-0" aria-label={`${player.name} vs ${opponent.name}`}>
          <span>{player.emoji}</span>
          <span className="text-[9px] lg:text-xs text-gray-500">VS</span>
          <span>{opponent.emoji}</span>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Resume: the big square, first thing under the thumb */}
        <button
          onClick={onResume}
          style={{ width: 'var(--resume)', height: 'var(--resume)' }}
          className="shrink-0 rounded-xl bg-yellow-500 text-black font-bold flex flex-col items-center justify-center gap-2
                     text-sm lg:text-lg hover:bg-yellow-400 transition-colors shadow-lg active:scale-95"
        >
          <Play className="w-7 h-7 lg:w-10 lg:h-10" fill="currentColor" />
          Resume
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div style={{ height: 'var(--tile)' }} className={`grid gap-3 ${canFullscreen ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <SettingTile label="Music" icon={<Music className="w-[18px] h-[18px] lg:w-6 lg:h-6" />} on={music} onChange={setMusic} />
            <SettingTile label="Sound" icon={<Volume2 className="w-[18px] h-[18px] lg:w-6 lg:h-6" />} on={sfx} onChange={setSfx} />
            {canFullscreen && (
              <SettingTile
                label="Full screen"
                icon={<Maximize className="w-[18px] h-[18px] lg:w-6 lg:h-6" />}
                on={full}
                onChange={(on) => {
                  setFullscreen(on);
                  if (on) enterFullscreen();
                  else exitFullscreen();
                }}
              />
            )}
          </div>

          {/* Quit / Credits, swapped in place for the quit confirmation */}
          <div style={{ height: 'var(--act)' }} className="grid grid-cols-2 gap-3">
            {confirmQuit ? (
              <>
                <button
                  onClick={() => setConfirmQuit(false)}
                  className="rounded-xl border border-white/15 bg-white/5 text-gray-200 text-xs lg:text-sm font-semibold
                             flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-colors active:scale-95"
                >
                  <Swords size={16} />
                  Keep fighting
                </button>
                <button
                  onClick={onQuit}
                  className="rounded-xl bg-red-600 text-white text-xs lg:text-sm font-bold
                             flex items-center justify-center gap-2 hover:bg-red-500 transition-colors active:scale-95"
                >
                  <LogOut size={16} />
                  Yes, quit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmQuit(true)}
                  className="rounded-xl border border-red-400/40 bg-red-500/10 text-red-300 text-xs lg:text-sm font-semibold
                             flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors active:scale-95"
                >
                  <LogOut size={16} />
                  Quit
                </button>
                <button
                  onClick={onCredits}
                  className="rounded-xl border border-white/15 bg-white/5 text-gray-300 text-xs lg:text-sm font-semibold
                             flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-colors active:scale-95"
                >
                  <Info size={16} />
                  Credits
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
