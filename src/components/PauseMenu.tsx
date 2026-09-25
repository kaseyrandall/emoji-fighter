import React from 'react';
import { motion } from 'framer-motion';
import { Info, LogOut, Maximize, Music, Play, Volume2 } from 'lucide-react';
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
      className={`relative h-16 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors active:scale-95 ${
        on ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-300' : 'border-white/10 bg-white/[0.03] text-gray-500'
      }`}
    >
      <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${on ? 'bg-green-400' : 'bg-gray-600'}`} />
      {icon}
      <span className="text-[9px] font-semibold whitespace-nowrap">{label}</span>
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

// The pause screen: one card with the matchup, a big Resume, the settings as
// tap tiles (remembered on the device), then Quit / Credits.
export default function PauseMenu({ player, opponent, fight, totalFights, round, onResume, onQuit, onCredits }: PauseMenuProps) {
  const { music, sfx, setMusic, setSfx, setFullscreen } = useSettings();
  // Fullscreen shows the real state: the player can also leave it with the
  // system back / swipe gesture or Esc.
  const [full, setFull] = React.useState(isFullscreen);
  React.useEffect(() => onFullscreenChange(() => setFull(isFullscreen())), []);
  const canFullscreen = fullscreenSupported();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="w-[24rem] max-w-[92vw] rounded-2xl border border-white/10 bg-gray-950/85 backdrop-blur-md shadow-2xl p-4 sm:p-5 text-left"
    >
      {/* Header: title + where you are in the gauntlet */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg tracking-widest text-white">PAUSED</h2>
          <p className="mt-1.5 text-[10px] tracking-wider text-gray-400 uppercase">
            Fight {fight}/{totalFights} · Round {round}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-2xl shrink-0" aria-label={`${player.name} vs ${opponent.name}`}>
          <span>{player.emoji}</span>
          <span className="text-[9px] text-gray-500">VS</span>
          <span>{opponent.emoji}</span>
        </div>
      </div>

      <button
        onClick={onResume}
        className="h-14 w-full rounded-xl bg-yellow-500 text-black text-base font-bold flex items-center justify-center gap-2
                   hover:bg-yellow-400 transition-colors shadow-lg active:scale-95"
      >
        <Play size={18} fill="currentColor" />
        Resume
      </button>

      <div className={`grid gap-2 mt-3 ${canFullscreen ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <SettingTile label="Music" icon={<Music size={18} />} on={music} onChange={setMusic} />
        <SettingTile label="Sound" icon={<Volume2 size={18} />} on={sfx} onChange={setSfx} />
        {canFullscreen && (
          <SettingTile
            label="Full screen"
            icon={<Maximize size={18} />}
            on={full}
            onChange={(on) => {
              setFullscreen(on);
              if (on) enterFullscreen();
              else exitFullscreen();
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={onQuit}
          className="h-12 rounded-xl border border-red-400/40 bg-red-500/10 text-red-300 text-xs font-semibold
                     flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors active:scale-95"
        >
          <LogOut size={16} />
          Quit
        </button>
        <button
          onClick={onCredits}
          className="h-12 rounded-xl border border-white/15 bg-white/5 text-gray-300 text-xs font-semibold
                     flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-colors active:scale-95"
        >
          <Info size={16} />
          Credits
        </button>
      </div>
    </motion.div>
  );
}
