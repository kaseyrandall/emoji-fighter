import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';
import LandingPage from './pages/LandingPage';
import CharacterSelect from './pages/CharacterSelect';
import GameArena from './pages/GameArena';
import { useOrientation } from './hooks/useOrientation';
import OrientationModal from './components/OrientationModal';
import { AnimatePresence } from 'framer-motion';

function AppContent() {
  const isLandscape = useOrientation();
  const location = useLocation();
  
  React.useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);
  
  const showOrientationModal = !isLandscape && location.pathname !== '/';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
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