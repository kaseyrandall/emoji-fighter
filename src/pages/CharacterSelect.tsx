import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { characters } from '../data/characters';
import { useGameStore } from '../store/gameStore';
import { Activity, Zap, Sword, Fish as Fist, Bot as Boot, Sparkles, ArrowLeft } from 'lucide-react';

export default function CharacterSelect() {
  const navigate = useNavigate();
  const { selectCharacter, selectOpponent } = useGameStore();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const handleCharacterSelect = (characterId: string) => {
    setSelectedId(characterId);
    
    const character = characters.find(c => c.id === characterId);
    if (character) {
      ReactGA.event({
        category: 'Game',
        action: 'Character Selected',
        label: character.name
      });
    }
    
    // Play selection sound
    new Audio('/assets/select.wav').play().catch(() => {});
    
    // Delay navigation to show selection effect
    setTimeout(() => {
    const character = characters.find(c => c.id === characterId);
    if (character) {
      selectCharacter(character);
      selectOpponent();
      navigate('/arena');
    }
    }, 500);
  };

  const StatDisplay = ({ value, icon: Icon, label }: { value: number; icon: typeof Activity; label: string }) => (
    <div className="flex items-center gap-2 bg-gray-800/50 px-2 py-1 lg:px-3 lg:py-2 rounded">
      <span className="text-[10px] lg:text-xs text-left leading-tight">{label}</span>
      <span className="text-[10px] lg:text-xs text-yellow-400 ml-auto">{value}</span>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-1 px-3 py-2 overflow-y-auto">
      <button
        onClick={() => navigate('/')}
        className="fixed top-2 left-2 z-10 p-2 text-gray-400 hover:text-white transition-colors
                 flex items-center gap-1 bg-gray-800/50 rounded-lg backdrop-blur-sm text-xs lg:text-sm"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      <h2 className="text-lg lg:text-4xl font-bold text-center">Choose Your Fighter</h2>
      <div className="text-[10px] lg:text-sm text-center px-4 pb-1 lg:pb-3 text-gray-400">
        Keyboard (WASD/JKL) on desktop, touch controls on mobile
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 lg:gap-4 max-w-5xl w-full">
        {characters.map((character) => (
          <motion.button
            key={character.id}
            onClick={() => handleCharacterSelect(character.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              scale: selectedId === character.id ? [1, 1.1, 1] : 1,
              borderColor: selectedId === character.id ? '#ffd700' : '#1f2937'
            }}
            className={`bg-gray-800 p-2 lg:p-4 rounded-lg border-2 transition-colors
                     flex flex-col items-center gap-1 lg:gap-3 group relative
                     ${selectedId === character.id ? 'border-yellow-400' : 'border-transparent'}`}
          >
            <div className="text-3xl lg:text-6xl group-hover:scale-110 transition-transform">
              {character.emoji}
            </div>
            <div className="text-center w-full">
              <div className="font-bold text-xs lg:text-base mb-1 lg:mb-2 leading-tight">{character.name}</div>
              <p className="hidden lg:block text-xs text-gray-400 mb-3">{character.description}</p>
              <div className="space-y-1">
                <StatDisplay value={character.moves.punch} icon={Fist} label="Punch" />
                <StatDisplay value={character.moves.kick} icon={Boot} label="Kick" />
                <StatDisplay value={character.moves.special} icon={Sparkles} label={character.specialName} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

    </div>
  );
}