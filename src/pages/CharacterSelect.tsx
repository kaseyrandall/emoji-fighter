import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { characters } from '../data/characters';
import { useGameStore, GAUNTLET_SIZE } from '../store/gameStore';
import { Swords, Sparkles, ArrowLeft } from 'lucide-react';

const StatBar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-2">
    <span className="w-[70px] sm:w-24 text-[11px] sm:text-xs text-gray-300 text-left shrink-0">{label}</span>
    <div className="flex-1 h-2.5 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
        style={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
      />
    </div>
  </div>
);

export default function CharacterSelect() {
  const navigate = useNavigate();
  const startGauntlet = useGameStore((s) => s.startGauntlet);
  const [selectedId, setSelectedId] = React.useState<string>(characters[0].id);

  const selected = characters.find((c) => c.id === selectedId) || characters[0];

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
    <div className="h-[100dvh] flex flex-col overflow-hidden px-3 pt-2 pb-2">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1
                   bg-gray-800/50 rounded-lg backdrop-blur-sm text-xs lg:text-sm"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h2 className="text-base lg:text-3xl font-bold text-center">Choose Your Fighter</h2>
        <div className="w-14" />
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        {/* Portrait grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 lg:gap-2">
            {characters.map((character) => {
              const isSelected = character.id === selectedId;
              return (
                <button
                  key={character.id}
                  onClick={() => handleSelect(character.id)}
                  className={`relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-1
                           transition-colors bg-gray-800/70 hover:bg-gray-700/70
                           ${isSelected ? 'border-yellow-400 bg-gray-700 ring-2 ring-yellow-400/40' : 'border-gray-700/60'}`}
                >
                  <span className="text-4xl sm:text-5xl lg:text-6xl leading-none">{character.emoji}</span>
                  <span className="text-[11px] sm:text-xs lg:text-sm font-semibold text-gray-200 leading-tight text-center line-clamp-2 px-0.5">
                    {character.name}
                  </span>
                </button>
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
          className="w-40 sm:w-52 lg:w-72 shrink-0 flex flex-col bg-gray-800/60 rounded-xl p-2 lg:p-4 border border-gray-700/60"
        >
          <div className="flex items-center gap-2 lg:gap-3">
            <span className="text-5xl sm:text-6xl lg:text-7xl leading-none">{selected.emoji}</span>
            <div className="min-w-0">
              <div className="font-bold text-lg sm:text-xl lg:text-2xl leading-tight">{selected.name}</div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs lg:text-sm text-yellow-400 mt-0.5">
                <Sparkles size={12} className="shrink-0" />
                <span>{selected.specialName}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs lg:text-sm text-gray-400 mt-2 lg:mt-3 leading-snug">{selected.description}</p>

          <div className="mt-3 lg:mt-4 space-y-2 lg:space-y-2.5">
            <StatBar label="Power" value={selected.stats.power} />
            <StatBar label="Speed" value={selected.stats.speed} />
            <StatBar label="Technique" value={selected.stats.technique} />
          </div>

          <div className="mt-auto pt-2">
            <div className="text-[9px] lg:text-[11px] text-gray-400 text-center mb-1">
              Gauntlet: {GAUNTLET_SIZE} fights, rising difficulty
            </div>
            <motion.button
              onClick={handleFight}
              whileTap={{ scale: 0.95 }}
              className="w-full py-2 lg:py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg
                       font-bold text-sm lg:text-lg flex items-center justify-center gap-2
                       shadow-lg shadow-red-900/40 active:brightness-110"
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
