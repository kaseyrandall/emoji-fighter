import React from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import ReactGA from './lib/analytics';
import LandingPage from './pages/LandingPage';
import CharacterSelect from './pages/CharacterSelect';
import GameArena from './pages/GameArena';
import { useOrientation } from './hooks/useOrientation';
import { usePreventZoom } from './hooks/usePreventZoom';
import OrientationModal from './components/OrientationModal';
import { AnimatePresence } from 'framer-motion';
import { exitApp, initNative, isNative } from './lib/native';
import { useGameStore } from './store/gameStore';

function AppContent() {
  const isLandscape = useOrientation();
  const location = useLocation();
  const navigate = useNavigate();

  // App store builds: the Android back button pauses / resumes a fight and
  // otherwise steps back a screen, leaving the app from the home screen.
  const path = React.useRef(location.pathname);
  path.current = location.pathname;
  React.useEffect(() => {
    initNative(() => {
      const { gameStatus, togglePause, resetGame } = useGameStore.getState();
      if (path.current === '/arena' && (gameStatus === 'playing' || gameStatus === 'paused')) togglePause();
      else if (path.current === '/arena') {
        resetGame();
        navigate('/select');
      }
      else if (path.current === '/select') navigate('/');
      else exitApp();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // iOS (Safari & Chrome are both WebKit) ignores user-scalable=no; block the
  // pinch / double-tap zoom gestures directly instead.
  usePreventZoom();

  React.useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);
  
  // (The app store builds are locked to landscape.)
  const showOrientationModal = !isNative && !isLandscape && location.pathname !== '/';

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 to-black text-white">
      <AnimatePresence>
        {showOrientationModal && <OrientationModal />}
      </AnimatePresence>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/select" element={<CharacterSelect />} />
        <Route path="/arena" element={<GameArena />} />
      </Routes>      
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;