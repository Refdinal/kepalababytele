export function findPairs(cards) {
  const groups = new Map();
  const jokers = [];

  for (const card of cards) {
    if (card.rank === 'JOKER') {
      jokers.push(card);
      continue;
    }
    const key = `${card.color}:${card.rank}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }

  const pairs = [];
  const remainingCards = [...jokers];

  for (const group of groups.values()) {
    const pairCount = Math.floor(group.length / 2);
    for (let i = 0; i < pairCount; i += 1) {
      pairs.push([group[i * 2], group[i * 2 + 1]]);
    }
    for (let i = pairCount * 2; i < group.length; i += 1) {
      remainingCards.push(group[i]);
    }
  }

  return { pairs, remainingCards };
}

export function discardPairs(cards) {
  const { pairs, remainingCards } = findPairs(cards);
  return { pairs, discarded: pairs.flat(), remainingCards };
}
