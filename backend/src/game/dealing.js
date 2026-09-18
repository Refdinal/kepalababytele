export function dealCards(deck, playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new RangeError('playerCount harus integer >= 1');
  }
  const hands = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < deck.length; i += 1) {
    hands[i % playerCount].push(deck[i]);
  }
  return hands;
}
