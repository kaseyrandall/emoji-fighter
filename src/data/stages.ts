// Import stage backgrounds
import nightMarket from '/assets/night-market.png';
import retroArcade from '/assets/retro-arcade.png';
import rooftopParty from '/assets/rooftop-party.png';
import seafoodPier from '/assets/seafood-pier.png';
import spaceStation from '/assets/space-station.png';
import westernTown from '/assets/western-town.png';

import { Stage } from '../types/game';

export const stages: Stage[] = [
  {
    id: 'night-market',
    name: 'Night Market',
    background: nightMarket,
    description: 'A bustling street market illuminated by neon lights',
    floorColor: '',
    ambientLight: 'bg-purple-500/20'
  },
  {
    id: 'retro-arcade',
    name: 'Retro Arcade',
    background: retroArcade,
    description: 'A nostalgic arcade filled with classic games',
    floorColor: '',
    ambientLight: 'bg-blue-500/20'
  },
  {
    id: 'rooftop-party',
    name: 'Rooftop Party',
    background: rooftopParty,
    description: 'A vibrant rooftop with city lights',
    floorColor: '',
    ambientLight: 'bg-red-500/20'
  },
  {
    id: 'seafood-pier',
    name: 'Seafood Pier',
    background: seafoodPier,
    description: 'A lively pier with fresh seafood stalls',
    floorColor: '',
    ambientLight: 'bg-cyan-500/20'
  },
  {
    id: 'space-station',
    name: 'Space Station',
    background: spaceStation,
    description: 'A futuristic space station orbiting Earth',
    floorColor: '',
    ambientLight: 'bg-violet-500/20'
  },
  {
    id: 'western-town',
    name: 'Western Town',
    background: westernTown,
    description: 'A dusty town in the Old West',
    floorColor: '',
    ambientLight: 'bg-amber-500/20'
  }
];