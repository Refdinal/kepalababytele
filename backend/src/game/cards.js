export const SUITS = [
  { code: 'H', suit: 'HEART', color: 'RED', symbol: '\u2665' },
  { code: 'D', suit: 'DIAMOND', color: 'RED', symbol: '\u2666' },
  { code: 'S', suit: 'SPADE', color: 'BLACK', symbol: '\u2660' },
  { code: 'C', suit: 'CLUB', color: 'BLACK', symbol: '\u2663' },
];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const JOKER = { id: 'JOKER', rank: 'JOKER', suit: null, color: null };

const SUIT_BY_CODE = Object.fromEntries(SUITS.map((suit) => [suit.code, suit]));

export function cardFromCode(code) {
  if (code === 'JOKER') return { ...JOKER };
  const match = /^([HDSC])(10|[2-9AJQK])$/.exec(code);
  if (!match) throw new Error(`Kode kartu tidak valid: ${code}`);
  const suit = SUIT_BY_CODE[match[1]];
  return { id: code, rank: match[2], suit: suit.suit, color: suit.color };
}

export function formatCard(card) {
  if (!card) return '';
  if (card.rank === 'JOKER') return 'JOKER';
  const suit = SUITS.find((s) => s.suit === card.suit);
  return `${suit ? suit.symbol : ''}${card.rank}`;
}
