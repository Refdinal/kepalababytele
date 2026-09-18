import { SUITS, RANKS, JOKER } from './cards.js';
import { secureShuffle } from './shuffle.js';

export function createDeck() {
  const deck = [];
  for (const { code, suit, color } of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${code}${rank}`, rank, suit, color });
    }
  }
  deck.push({ ...JOKER });
  return deck;
}

export function createShuffledDeck() {
  return secureShuffle(createDeck());
}
