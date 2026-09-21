import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { Swords, ArrowLeft } from 'lucide-react';

const EmojiRain = () => {
  const emojis = ['🥷', '🤖', '👽', '🐲', '💩', '👊', '🦾', '💥', '⚡️', '🔥'];
  const [particles, setParticles] = React.useState<Array<{ id: number; emoji: string; x: number; scale: number; speed: number }>>([]);
  const nextId = React.useRef(0);

  React.useEffect(() => {
    const makeParticle = () => ({
      id: nextId.current++,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      x: Math.random() * 100,
      scale: 0.5 + Math.random() * 1.5,
      speed: 3 + Math.random() * 5
    });

    // Initial particles
    setParticles(Array.from({ length: 20 }, makeParticle));

    // Continuously add new particles, dropping the oldest so the list stays bounded
    const interval = setInterval(() => {
      setParticles(current => [...current.slice(-29), makeParticle()]);
    }, 300);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {particles.map((particle, i) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{ fontSize: `${particle.scale}rem` }}
          initial={{ y: -20, x: `${particle.x}vw`, opacity: 0 }}
          animate={{
            y: '120vh',
            opacity: [0, 1, 1, 0],
            rotate: [0, particle.speed > 5 ? 360 : 0]
          }}
          transition={{
            duration: particle.speed,
            repeat: 0,
            ease: 'linear'
          }}
        >
          {particle.emoji}
        </motion.div>
      ))}
    </div>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <EmojiRain />
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Swords className="w-16 h-16 text-yellow-500" />
        </div>
        <h1 className="text-5xl lg:text-6xl font-bold mb-4">Emoji Fighter</h1>
        <p className="text-xl mb-8 text-gray-300">Battle with emoji warriors!</p>
        <button
          onClick={() => {
            ReactGA.event({
              category: 'Game',
              action: 'Start Game',
              label: 'Landing Page'
            });
            navigate('/select');
          }}
          className="px-8 py-4 bg-yellow-500 text-black rounded-lg text-xl font-bold 
                   hover:bg-yellow-400 transition-colors shadow-lg
                   active:transform active:scale-95"
        >
          Play Now
        </button>
      </div>
      <footer className="footer">
        Copyright Edge Kase Inc 2025. All Rights Reserved.
      </footer>
    </div>
  );
}