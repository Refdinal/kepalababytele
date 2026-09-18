export function getNextActivePlayer(players, currentSeat) {
  const count = players.length;
  if (count === 0) return null;
  for (let step = 1; step <= count; step += 1) {
    const seat = (currentSeat + step) % count;
    const player = players.find((p) => p.seatNumber === seat);
    if (player && player.status === 'ACTIVE') return player;
  }
  return null;
}

export function getActivePlayers(players) {
  return players.filter((p) => p.status === 'ACTIVE');
}
