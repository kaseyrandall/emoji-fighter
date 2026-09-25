import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { AnimatePresence } from 'framer-motion';
import { Swords, Info, History } from 'lucide-react';
import Credits from '../components/Credits';
import { enterFullscreen, exitFullscreen } from '../lib/fullscreen';
import { useSettings } from '../store/settingsStore';
import LandingScene from '../three/LandingScene';

// Secondary home-page buttons: same height as each other (48px), outlined so
// Play Now stays the clear primary action.
const SECONDARY_BUTTON =
  'h-12 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 ' +
  'text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap hover:bg-white/10 hover:text-white ' +
  'transition-colors active:scale-95 backdrop-blur-sm';

export default function LandingPage() {
  const navigate = useNavigate();
  // The home page is an ordinary web page: coming back here leaves full screen.
  React.useEffect(() => exitFullscreen(), []);
  const [showCredits, setShowCredits] = React.useState(false);

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col">
      <LandingScene />

      {/* Content fills the space above the footer and stays centered — sized to
          fit a short landscape phone without scrolling. */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 text-center">
        <Swords className="w-11 h-11 lg:w-16 lg:h-16 text-yellow-500 mb-3 lg:mb-5" />
        {/* Title stays on one line and scales with a narrow (portrait) screen;
            the "3D" badge is anchored to the end of the text, not the page. */}
        <h1 className="whitespace-nowrap text-[clamp(1.25rem,6.2vw,2.25rem)] sm:text-4xl lg:text-6xl font-bold mb-1.5 lg:mb-3 drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
          <span className="relative inline-block">
            Emoji Fighter
            <span
              className="absolute -top-[0.75em] -right-[0.7em] rotate-12 rounded-md px-1.5 py-0.5 lg:px-2 lg:py-1
                       text-[0.4em] leading-none font-black text-black bg-gradient-to-br from-yellow-300 to-orange-500
                       shadow-[0_0_18px_rgba(245,158,11,0.7)] border-2 border-black/60"
            >
              3D
            </span>
          </span>
        </h1>
        <p className="text-[clamp(0.6rem,3.1vw,0.875rem)] sm:text-sm lg:text-xl mb-5 lg:mb-8 text-gray-300">Battle with emoji warriors!</p>
        {/* Menu: one consistent button system. Every button is 48px+ tall
            (a comfortable thumb target) with 12px between them; Play Now is
            full width, the two secondary actions split the row below it. */}
        <div className="w-72 max-w-[85vw] lg:w-80 flex flex-col gap-3">
          <button
            onClick={() => {
              ReactGA.event({
                category: 'Game',
                action: 'Start Game',
                label: 'Landing Page'
              });
              // Full screen from here through fighter select and the fights.
              if (useSettings.getState().fullscreen) enterFullscreen();
              navigate('/select');
            }}
            className="h-14 lg:h-16 w-full bg-yellow-500 text-black rounded-xl text-lg lg:text-xl font-bold
                     hover:bg-yellow-400 transition-colors shadow-lg active:scale-95"
          >
            Play Now
          </button>
          <div className="grid grid-cols-2 gap-3">
            {/* The original 2D game, kept playable as a static build at /classic/ */}
            <a
              href="/classic/"
              onClick={() => ReactGA.event({ category: 'Game', action: 'Open Classic', label: 'Landing Page' })}
              className={SECONDARY_BUTTON}
            >
              <History size={16} className="shrink-0" />
              Classic
            </a>
            <button onClick={() => setShowCredits(true)} className={SECONDARY_BUTTON}>
              <Info size={16} className="shrink-0" />
              Credits
            </button>
          </div>
        </div>
      </main>

      {/* In-flow footer (not fixed), so it never overlaps or pushes content. */}
      <footer
        className="relative z-10 shrink-0 text-center text-[9px] sm:text-[11px] leading-relaxed text-gray-400 px-4 pt-1 pb-2"
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