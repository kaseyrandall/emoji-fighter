import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { characters } from '../data/characters';
import { useGameStore } from '../store/gameStore';
import { Swords, Sparkles, ArrowLeft } from 'lucide-react';
import { Character } from '../types/game';

// Signature colour per fighter — drives the tile glow, stat bars, name glow,
// and the reactive background so each pick feels distinct.
const ACCENTS: Record<string, string> = {
  ninja: '#818cf8', robot: '#22d3ee', alien: '#a78bfa', dragon: '#10b981',
  poop: '#d97706', ghost: '#cbd5e1', zombie: '#84cc16', trex: '#22c55e',
  octopus: '#f472b6', gorilla: '#9ca3af', devil: '#a855f7', ice: '#38bdf8',
  chicken: '#facc15', unicorn: '#e879f9', clown: '#ef4444',
};
const accentOf = (id: string) => ACCENTS[id] ?? '#f59e0b';

const overallOf = (c: Character) =>
  Math.round(((c.stats.power + c.stats.speed + c.stats.technique) / 3) * 10) / 10;
const tierOf = (ovr: number) => (ovr >= 8.7 ? 'S' : ovr >= 8 ? 'A' : ovr >= 7.3 ? 'B' : 'C');

const StatBar = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-8 text-[10px] sm:text-xs text-gray-400 text-left shrink-0">{label}</span>
    <div className="flex-1 h-2 sm:h-2.5 bg-gray-700/80 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
    <span className="w-3.5 text-right text-[10px] sm:text-xs text-gray-400 tabular-nums shrink-0">{value}</span>
  </div>
);

export default function CharacterSelect() {
  const navigate = useNavigate();
  const startGauntlet = useGameStore((s) => s.startGauntlet);
  const [selectedId, setSelectedId] = React.useState<string>(characters[0].id);

  const selected = characters.find((c) => c.id === selectedId) || characters[0];
  const accent = accentOf(selected.id);
  const overall = overallOf(selected);
  const tier = tierOf(overall);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    new Audio('/assets/select.wav').play().catch(() => {});
  };

  const handleFight = () => {
    ReactGA.event({ category: 'Game', action: 'Fight Started', label: selected.name });
    startGauntlet(selected);
    navigate('/arena');
  };

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden px-2 py-2 gap-1.5">
      {/* Reactive background glow, tinted by the selected fighter */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-all duration-500"
        style={{ background: `radial-gradient(60% 60% at 80% 50%, ${accent}22, transparent 70%)` }}
      />

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => navigate('/')}
          className="px-2 py-1.5 text-gray-300 hover:text-white transition-colors flex items-center gap-1
                   bg-gray-800/60 rounded-lg backdrop-blur-sm text-xs"
        >
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>
        <h2 className="text-sm sm:text-xl lg:text-2xl font-bold text-center bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
          Choose Your Fighter
        </h2>
        <div className="w-12" />
      </div>

      {/* Body: roster grid + detail panel */}
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Roster — square tiles so emoji + name always fit; scrolls if the
            device is too short to show every row. */}
        <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
          <div className="grid grid-cols-5 gap-1.5 content-start">
            {characters.map((character) => {
              const isSelected = character.id === selectedId;
              const a = accentOf(character.id);
              return (
                <motion.button
                  key={character.id}
                  onClick={() => handleSelect(character.id)}
                  whileTap={{ scale: 0.94 }}
                  className="relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center
                           bg-gray-800/70 hover:bg-gray-700/70 transition-colors"
                  style={{
                    borderColor: isSelected ? a : 'rgba(75,85,99,0.55)',
                    boxShadow: isSelected ? `0 0 18px ${a}66, inset 0 0 16px ${a}22` : undefined,
                  }}
                >
                  <span
                    className="text-2xl sm:text-3xl lg:text-4xl leading-none"
                    style={{ filter: isSelected ? `drop-shadow(0 0 8px ${a}aa)` : undefined }}
                  >
                    {character.emoji}
                  </span>
                  <span
                    className="mt-0.5 w-full px-0.5 text-[9px] sm:text-[10px] lg:text-xs font-semibold leading-[1.05] text-center line-clamp-2"
                    style={{ color: isSelected ? '#fff' : '#cbd5e1' }}
                  >
                    {character.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Detail panel — FIGHT stays pinned at the bottom; the description
            flexes and clips so the button is never pushed off-screen. */}
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-[38%] max-w-[17rem] lg:w-72 shrink-0 flex flex-col rounded-xl p-2 lg:p-3 border overflow-hidden bg-gray-900/75"
          style={{ borderColor: `${accent}88`, boxShadow: `0 0 26px ${accent}22 inset` }}
        >
          {/* faded emoji watermark */}
          <span
            className="pointer-events-none absolute -right-4 -bottom-6 text-[8rem] lg:text-[12rem] leading-none opacity-[0.06] select-none"
            aria-hidden
          >
            {selected.emoji}
          </span>

          {/* Identity */}
          <div className="relative flex items-center gap-2 shrink-0">
            <span className="text-4xl sm:text-5xl lg:text-6xl leading-none" style={{ filter: `drop-shadow(0 0 10px ${accent}88)` }}>
              {selected.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1">
                <div
                  className="font-bold text-sm sm:text-lg lg:text-xl leading-[1.05] flex-1 break-words line-clamp-2"
                  style={{ textShadow: `0 0 12px ${accent}66` }}
                >
                  {selected.name}
                </div>
                <div
                  className="shrink-0 w-5 h-5 lg:w-7 lg:h-7 rounded-md flex items-center justify-center font-bold text-xs lg:text-base"
                  style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}88` }}
                  title={`Overall ${overall}`}
                >
                  {tier}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs mt-0.5" style={{ color: accent }}>
                <Sparkles size={11} className="shrink-0" />
                <span className="truncate">{selected.specialName}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="relative mt-2 space-y-1.5 shrink-0">
            <StatBar label="POW" value={selected.stats.power} accent={accent} />
            <StatBar label="SPD" value={selected.stats.speed} accent={accent} />
            <StatBar label="TEC" value={selected.stats.technique} accent={accent} />
          </div>

          {/* Description — flexible + clipped so it can't push FIGHT away */}
          <p className="relative flex-1 min-h-0 overflow-hidden mt-2 text-[11px] lg:text-sm text-gray-400 leading-snug">
            {selected.description}
          </p>

          {/* FIGHT — always visible */}
          <motion.button
            onClick={handleFight}
            whileTap={{ scale: 0.96 }}
            animate={{ boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 20px rgba(239,68,68,0.5)', '0 0 0px rgba(239,68,68,0)'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="relative shrink-0 mt-2 w-full py-2.5 lg:py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg
                     font-bold text-sm lg:text-lg flex items-center justify-center gap-2"
          >
            <Swords size={18} />
            FIGHT
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
