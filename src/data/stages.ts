// Stage backgrounds live in the public/ folder and are referenced by URL.
// Masters are kept as PNG in "_assets/Background Art/"; these are WebP
// re-encodes of them, which keeps the arena light enough to load on mobile.
const canopyArena = '/assets/canopy-arena.webp';
const pirateCove = '/assets/pirate-cove.webp';
const jungleTemple = '/assets/jungle-temple.webp';
const emojiFactory = '/assets/emoji-factory.webp';
const neonSubway = '/assets/neon-subway.webp';
const sunsetGasStation = '/assets/sunset-gas-station.webp';

import { Stage } from '../types/game';

export const stages: Stage[] = [
  {
    id: 'canopy-arena',
    name: 'Canopy Arena',
    background: canopyArena,
    description: 'A lantern-lit duelling ring high in the treetops',
    floorColor: '',
    ambientLight: 'bg-amber-500/20'
  },
  {
    id: 'pirate-cove',
    name: 'Pirate Cove',
    background: pirateCove,
    description: 'A sunset dock in the shadow of a corsair galleon',
    floorColor: '',
    ambientLight: 'bg-orange-500/20'
  },
  {
    id: 'jungle-temple',
    name: 'Jungle Temple',
    background: jungleTemple,
    description: 'Stone guardians watching over an overgrown ruin',
    floorColor: '',
    ambientLight: 'bg-emerald-500/20'
  },
  {
    id: 'emoji-factory',
    name: 'Emoji Factory',
    background: emojiFactory,
    description: 'The assembly line where every emoji is forged',
    floorColor: '',
    ambientLight: 'bg-yellow-500/20'
  },
  {
    id: 'neon-subway',
    name: 'Neon Subway',
    background: neonSubway,
    description: 'A humming platform under the neon-soaked city',
    floorColor: '',
    ambientLight: 'bg-fuchsia-500/20'
  },
  {
    id: 'sunset-gas-station',
    name: 'Sunset Gas Station',
    background: sunsetGasStation,
    description: 'A roadside forecourt on the last stretch of desert highway',
    floorColor: '',
    ambientLight: 'bg-orange-500/20'
  }
];
