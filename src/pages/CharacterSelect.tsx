import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { characters } from '../data/characters';
import { useGameStore, GAUNTLET_SIZE } from '../store/gameStore';
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
  <div className="flex items-center gap-2">
    <span className="w-[70px] sm:w-24 text-[11px] sm:text-xs text-gray-300 text-left shrink-0">{label}</span>
    <div className="flex-1 h-2.5 sm:h-3 bg-gray-700/80 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
    <span className="w-4 text-right text-[10px] sm:text-xs text-gray-400 tabular-nums shrink-0">{value}</span>
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
    <div className="relative h-[100dvh] flex flex-col overflow-hidden px-3 pt-2 pb-2">
      {/* Reactive background glow, tinted by the selected fighter */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-all duration-500"
        style={{ background: `radial-gradient(60% 60% at 78% 50%, ${accent}22, transparent 70%)` }}
      />

      <div className="flex items-center justify-between mb-1 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1
                   bg-gray-800/50 rounded-lg backdrop-blur-sm text-xs lg:text-sm"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h2 className="text-base lg:text-3xl font-bold text-center bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
          Choose Your Fighter
        </h2>
        <div className="w-14" />
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        {/* Portrait grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 lg:gap-2">
            {characters.map((character) => {
              const isSelected = character.id === selectedId;
              const a = accentOf(character.id);
              return (
                <motion.button
                  key={character.id}
                  onClick={() => handleSelect(character.id)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-1
                           bg-gray-800/70 hover:bg-gray-700/70 transition-colors overflow-hidden"
                  style={{
                    borderColor: isSelected ? a : 'rgba(75,85,99,0.6)',
                    boxShadow: isSelected ? `0 0 22px ${a}66, inset 0 0 18px ${a}22` : undefined,
                  }}
                >
                  <motion.span
                    className="text-4xl sm:text-5xl lg:text-6xl leading-none"
                    animate={{ scale: isSelected ? 1.12 : 1, y: isSelected ? -1 : 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    style={{ filter: isSelected ? `drop-shadow(0 0 10px ${a}aa)` : undefined }}
                  >
                    {character.emoji}
                  </motion.span>
                  <span
                    className="text-[11px] sm:text-xs lg:text-sm font-semibold leading-tight text-center line-clamp-2 px-0.5"
                    style={{ color: isSelected ? '#fff' : '#d1d5db' }}
                  >
                    {character.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Detail / stats panel */}
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-40 sm:w-52 lg:w-72 shrink-0 flex flex-col rounded-xl p-2 lg:p-4 border overflow-hidden bg-gray-900/70"
          style={{ borderColor: `${accent}88`, boxShadow: `0 0 30px ${accent}22 inset` }}
        >
          {/* Giant faded emoji watermark */}
          <span
            className="pointer-events-none absolute -right-6 -bottom-8 text-[10rem] lg:text-[14rem] leading-none opacity-[0.07] select-none"
            aria-hidden
          >
            {selected.emoji}
          </span>

          <div className="relative flex items-start gap-2 lg:gap-3">
            <span className="text-5xl sm:text-6xl lg:text-7xl leading-none" style={{ filter: `drop-shadow(0 0 12px ${accent}88)` }}>
              {selected.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5">
                <div
                  className="font-bold text-lg sm:text-xl lg:text-2xl leading-tight flex-1"
                  style={{ textShadow: `0 0 14px ${accent}66` }}
                >
                  {selected.name}
                </div>
                <div
                  className="shrink-0 w-6 h-6 lg:w-8 lg:h-8 rounded-md flex items-center justify-center font-bold text-sm lg:text-lg"
                  style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}88` }}
                  title={`Overall ${overall}`}
                >
                  {tier}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs lg:text-sm mt-0.5" style={{ color: accent }}>
                <Sparkles size={12} className="shrink-0" />
                <span>{selected.specialName}</span>
              </div>
            </div>
          </div>

          <p className="relative text-[11px] sm:text-xs lg:text-sm text-gray-400 mt-2 lg:mt-3 leading-snug">
            {selected.description}
          </p>

          <div className="relative mt-3 lg:mt-4 space-y-2 lg:space-y-2.5">
            <StatBar label="Power" value={selected.stats.power} accent={accent} />
            <StatBar label="Speed" value={selected.stats.speed} accent={accent} />
            <StatBar label="Technique" value={selected.stats.technique} accent={accent} />
          </div>

          <div className="relative mt-auto pt-2">
            <div className="text-[9px] lg:text-[11px] text-gray-400 text-center mb-1">
              Gauntlet: {GAUNTLET_SIZE} fights, rising difficulty
            </div>
            <motion.button
              onClick={handleFight}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              animate={{ boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 22px rgba(239,68,68,0.55)', '0 0 0px rgba(239,68,68,0)'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-full py-2 lg:py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg
                       font-bold text-sm lg:text-lg flex items-center justify-center gap-2"
            >
              <Swords size={18} />
              FIGHT
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
