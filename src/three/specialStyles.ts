// How each fighter's special move looks. Every special combines sparks in
// the character's colour with a spray of themed emoji, delivered in one of
// a few shapes:
//   stream: a breath / beam that pours forward from the caster
//   burst:  an explosion on the target
//   rain:   emoji pelting down onto the target from above
//   rise:   emoji erupting up out of the floor under the target
export type SpecialMode = 'stream' | 'burst' | 'rain' | 'rise';

export interface SpecialStyle {
  color: string; // sparks, ring, charged aura, screen flash
  glyphs: string[]; // emoji thrown out by the effect
  mode: SpecialMode;
  gravity?: number; // on the emoji particles; negative floats them up
  floorRing?: boolean; // also send a shockwave along the floor
}

const STYLES: Record<string, SpecialStyle> = {
  ninja: { color: '#818cf8', glyphs: ['💨', '⭐', '💨'], mode: 'burst', gravity: -2 }, // Shadow Strike
  robot: { color: '#22d3ee', glyphs: ['⚡', '0️⃣', '1️⃣'], mode: 'burst' }, // System Overload
  alien: { color: '#a78bfa', glyphs: ['🛸', '✨', '🌟'], mode: 'stream' }, // Cosmic Blast
  dragon: { color: '#fb923c', glyphs: ['🔥'], mode: 'stream' }, // Dragon Breath
  poop: { color: '#84cc16', glyphs: ['💨', '🤢'], mode: 'stream', gravity: -1.5 }, // Toxic Gas
  ghost: { color: '#e2e8f0', glyphs: ['👻', '💀'], mode: 'stream' }, // Spectral Scream
  zombie: { color: '#65a30d', glyphs: ['🧠'], mode: 'rain' }, // Brain Buffet
  trex: { color: '#22c55e', glyphs: ['🦴', '💥'], mode: 'burst', floorRing: true }, // Jurassic Chomp
  octopus: { color: '#6d28d9', glyphs: ['⚫', '💦'], mode: 'burst' }, // Ink Bomb
  gorilla: { color: '#facc15', glyphs: ['💥', '⚡'], mode: 'rise', floorRing: true }, // Chest Thunder
  devil: { color: '#ef4444', glyphs: ['🔥'], mode: 'rise' }, // Hellfire
  ice: { color: '#7dd3fc', glyphs: ['❄️', '🧊'], mode: 'burst', floorRing: true }, // Absolute Zero
  chicken: { color: '#fde047', glyphs: ['🪶', '⭐'], mode: 'burst', gravity: -1 }, // Roundhouse Peck
  unicorn: { color: '#f0abfc', glyphs: ['🌈', '✨', '💖'], mode: 'stream' }, // Rainbow Ram
  clown: { color: '#f43f5e', glyphs: ['🎈', '🎉'], mode: 'burst', gravity: -3 }, // Balloon Bomb
};

const DEFAULT: SpecialStyle = { color: '#d8b4fe', glyphs: ['✨'], mode: 'burst' };

export const specialStyleOf = (id: string | undefined): SpecialStyle => (id && STYLES[id]) || DEFAULT;
