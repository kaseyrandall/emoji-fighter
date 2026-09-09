import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Swords } from 'lucide-react';
import { stages } from '../data/stages';
import { useGameStore } from '../store/gameStore';

export default function LevelSelect() {
  const navigate = useNavigate();
  const { setStage } = useGameStore();

  const handleStageSelect = (stageId: string) => {
    setStage(stageId);
    navigate('/select');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 p-2 text-gray-400 hover:text-white transition-colors
                 flex items-center gap-2 bg-gray-800/50 rounded-lg backdrop-blur-sm text-sm"
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <Swords className="w-16 h-16 text-yellow-500" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Select Your Arena</h1>
        <p className="text-gray-400">Choose where your battle will take place</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
        {stages.map((stage) => (
          <motion.button
            key={stage.id}
            onClick={() => handleStageSelect(stage.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group overflow-hidden rounded-lg"
          >
            <div 
              className="aspect-video w-full bg-cover bg-center rounded-lg border-2 border-transparent
                       group-hover:border-yellow-500 transition-colors"
              style={{ backgroundImage: `url(${stage.background})` }}
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center
                          opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">{stage.name}</h3>
                <p className="text-sm text-gray-300">{stage.description}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}