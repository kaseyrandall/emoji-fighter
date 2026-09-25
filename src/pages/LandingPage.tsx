import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { AnimatePresence } from 'framer-motion';
import { Swords, Info, History } from 'lucide-react';
import Credits from '../components/Credits';
import LandingScene from '../three/LandingScene';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showCredits, setShowCredits] = React.useState(false);

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col">
      <LandingScene />

      {/* Content fills the space above the footer and stays centered — sized to
          fit a short landscape phone without scrolling. */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 text-center">
        <Swords className="w-11 h-11 lg:w-16 lg:h-16 text-yellow-500 mb-3 lg:mb-5" />
        <h1 className="relative text-4xl lg:text-6xl font-bold mb-1.5 lg:mb-3 drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
          Emoji Fighter
          {/* "3D" badge, tucked against the end of the title */}
          <span
            className="absolute -top-3 -right-9 lg:-top-5 lg:-right-14 rotate-12 rounded-md px-1.5 py-0.5 lg:px-2 lg:py-1
                     text-sm lg:text-2xl font-black text-black bg-gradient-to-br from-yellow-300 to-orange-500
                     shadow-[0_0_18px_rgba(245,158,11,0.7)] border-2 border-black/60"
          >
            3D
          </span>
        </h1>
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
          <div className="flex items-center gap-1">
            {/* The original 2D game, kept playable as a static build at /classic/ */}
            <a
              href="/classic/"
              onClick={() => ReactGA.event({ category: 'Game', action: 'Open Classic', label: 'Landing Page' })}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-gray-300 hover:text-white
                       transition-colors text-sm font-semibold"
            >
              <History size={16} />
              Classic version
            </a>
            <button
              onClick={() => setShowCredits(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-gray-300 hover:text-white
                       transition-colors text-sm font-semibold"
            >
              <Info size={16} />
              Credits
            </button>
          </div>
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