// Signature colour per fighter — drives glows, stat bars, gloves and lights.
const ACCENTS: Record<string, string> = {
  ninja: '#818cf8', robot: '#22d3ee', alien: '#a78bfa', dragon: '#10b981',
  poop: '#d97706', ghost: '#cbd5e1', zombie: '#84cc16', trex: '#22c55e',
  octopus: '#f472b6', gorilla: '#9ca3af', devil: '#a855f7', ice: '#38bdf8',
  chicken: '#facc15', unicorn: '#e879f9', clown: '#ef4444',
};

export const accentOf = (id: string) => ACCENTS[id] ?? '#f59e0b';
