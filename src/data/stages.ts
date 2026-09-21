// Stage backgrounds live in the public/ folder and are referenced by URL.
const candyKingdom = '/assets/candy-kingdom.png';
const nightMarket = '/assets/night-market.png';
const retroArcade = '/assets/retro-arcade.png';
const rooftopParty = '/assets/rooftop-party.png';
const seafoodPier = '/assets/seafood-pier.png';
const spaceStation = '/assets/space-station.png';
const westernTown = '/assets/western-town.png';

import { Stage } from '../types/game';

export const stages: Stage[] = [
  {
    id: 'candy-kingdom',
    name: 'Candy Kingdom',
    background: candyKingdom,
    description: 'A sugar-spun realm of gumdrop hills and lollipop groves',
    floorColor: '',
    ambientLight: 'bg-pink-500/20'
  },
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