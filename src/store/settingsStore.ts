import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

// Player preferences, remembered on this device between visits.
interface Settings {
  music: boolean;
  sfx: boolean;
  fullscreen: boolean; // go fullscreen (hide the browser bar) while fighting
  setMusic: (on: boolean) => void;
  setSfx: (on: boolean) => void;
  setFullscreen: (on: boolean) => void;
}

// localStorage can be missing or throw (private browsing, blocked site data);
// settings then just last for the session instead of breaking the game.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* not persisted */ }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  },
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      music: true,
      sfx: true,
      fullscreen: true,
      setMusic: (music) => set({ music }),
      setSfx: (sfx) => set({ sfx }),
      setFullscreen: (fullscreen) => set({ fullscreen }),
    }),
    {
      name: 'emoji-fighter-settings',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ music: s.music, sfx: s.sfx, fullscreen: s.fullscreen }),
    }
  )
);
