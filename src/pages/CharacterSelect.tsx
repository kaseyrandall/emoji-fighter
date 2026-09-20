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
    <div className="flex items-center gap-3 bg-gray-800/50 px-3 py-2 rounded">      
      <span className="text-xs text-left">{label}</span>
      <span className="text-xs text-yellow-400 ml-auto">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 p-2 text-gray-400 hover:text-white transition-colors
                 flex items-center gap-2 bg-gray-800/50 rounded-lg backdrop-blur-sm text-sm"
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>
      
      <h2 className="text-2xl lg:text-4xl font-bold mb-8">Choose Your Fighter</h2>
      <div className="text-sm text-center p-8 text-gray-400">
        Use keyboard (WASD/JKL) on desktop or touch controls on mobile
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl">
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
            className={`bg-gray-800 p-6 rounded-lg border-2 transition-colors
                     flex flex-col items-center gap-4 group relative
                     ${selectedId === character.id ? 'border-yellow-400' : 'border-transparent'}`}
          >
            <div className="text-5xl lg:text-7xl group-hover:scale-110 transition-transform">
              {character.emoji}
            </div>
            <div className="text-center">
              <div className="font-bold mb-2">{character.name}</div>
              <p className="text-xs text-gray-400 mb-4">{character.description}</p>
              <div className="space-y-0">
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