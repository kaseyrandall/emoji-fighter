import { Character } from '../types/game';

export const characters: Character[] = [
  {
    id: 'ninja',
    name: 'Hustle Ninja',
    emoji: '🥷',
    health: 100,
    description: 'A swift warrior who strikes from the shadows.',
    stats: {
      power: 7,
      speed: 9,
      technique: 8
    },
    moves: {
      punch: 6,
      kick: 9,
      special: 18
    },
    specialName: 'Shadow Strike'
  },
  {
    id: 'robot',
    name: 'ChadGPT',
    emoji: '🤖',
    health: 100,
    description: 'A machine learning marvel with calculated moves.',
    stats: {
      power: 8,
      speed: 7,
      technique: 9
    },
    moves: {
      punch: 7,
      kick: 8,
      special: 16
    },
    specialName: 'System Overload'
  },
  {
    id: 'alien',
    name: 'Extra T',
    emoji: '👽',
    health: 100,
    description: 'An otherworldly fighter with mysterious powers.',
    stats: {
      power: 9,
      speed: 8,
      technique: 7
    },
    moves: {
      punch: 8,
      kick: 10,
      special: 20
    },
    specialName: 'Cosmic Blast'
  },
  {
    id: 'dragon',
    name: 'Dragon Warrior',
    emoji: '🐲',
    health: 100,
    description: 'Ancient guardian with the power of dragons.',
    stats: {
      power: 8,
      speed: 8,
      technique: 8
    },
    moves: {
      punch: 7,
      kick: 8,
      special: 17
    },
    specialName: 'Dragon Breath'
  },
  {
    id: 'poop',
    name: 'McPoop Face',
    emoji: '💩',
    health: 100,
    description: 'A stinky but surprisingly powerful contender.',
    stats: {
      power: 7,
      speed: 7,
      technique: 7
    },
    moves: {
      punch: 9,
      kick: 7,
      special: 15
    },
    specialName: 'Toxic Gas'
  }
];