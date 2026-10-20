import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ReactGA from './lib/analytics';
import App from './App.tsx';
import '@fontsource/press-start-2p/latin-400.css';
import './index.css';

// Initialize GA4 (website only; it loads gtag.js itself)
ReactGA.initialize('G-L28WSFVN18');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
