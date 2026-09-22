import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Info } from 'lucide-react';
import Credits from '../components/Credits';

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
  const [showCredits, setShowCredits] = React.useState(false);

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col">
      <EmojiRain />

      {/* Content fills the space above the footer and stays centered — sized to
          fit a short landscape phone without scrolling. */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 text-center">
        <Swords className="w-11 h-11 lg:w-16 lg:h-16 text-yellow-500 mb-3 lg:mb-5" />
        <h1 className="text-4xl lg:text-6xl font-bold mb-1.5 lg:mb-3">Emoji Fighter</h1>
        <p className="text-sm lg:text-xl mb-5 lg:mb-8 text-gray-300">Battle with emoji warriors!</p>
        <div className="flex flex-col items-center gap-2 lg:gap-3">
          <button
            onClick={() => {
              ReactGA.event({
                category: 'Game',
                action: 'Start Game',
                label: 'Landing Page'
              });
              navigate('/select');
            }}
            className="px-8 py-3 lg:py-4 bg-yellow-500 text-black rounded-lg text-lg lg:text-xl font-bold
                     hover:bg-yellow-400 transition-colors shadow-lg
                     active:transform active:scale-95"
          >
            Play Now
          </button>
          <button
            onClick={() => setShowCredits(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-gray-300 hover:text-white
                     transition-colors text-sm font-semibold"
          >
            <Info size={16} />
            Credits
          </button>
        </div>
      </main>

      {/* In-flow footer (not fixed), so it never overlaps or pushes content. */}
      <footer
        className="relative z-10 shrink-0 text-center text-[11px] text-gray-400 pt-1 pb-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        © 2026 Edge Kase Interactive. All Rights Reserved.
      </footer>

      <AnimatePresence>
        {showCredits && <Credits onClose={() => setShowCredits(false)} />}
      </AnimatePresence>
    </div>
  );
}