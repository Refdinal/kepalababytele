import { randomInt } from 'node:crypto';
import { createGame, startGame, drawCard, getTurnInfo, totalCardsInHands } from '../src/game/gameEngine.js';
import { findPairs } from '../src/game/pairing.js';

const TOTAL_CARDS = 53;
const MAX_TURNS_PER_GAME = 200000;
const MAX_PLAYERS = 8;

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `p${index + 1}`,
    telegramUserId: 1000 + index,
    username: `player${index + 1}`,
    displayName: `Player ${index + 1}`,
  }));
}

function checkInvariants(state, gameLabel) {
  const allCards = [...state.players.flatMap((player) => player.hand), ...state.discarded];
  if (allCards.length !== TOTAL_CARDS) {
    throw new Error(`${gameLabel}: jumlah kartu ${allCards.length}, seharusnya ${TOTAL_CARDS}`);
  }
  const ids = new Set(allCards.map((card) => card.id));
  if (ids.size !== TOTAL_CARDS) {
    throw new Error(`${gameLabel}: ada kartu duplikat atau hilang`);
  }
  if (totalCardsInHands(state) + state.discarded.length !== TOTAL_CARDS) {
    throw new Error(`${gameLabel}: invariant tangan + discarded gagal`);
  }
}

function checkDiscards(events, gameLabel) {
  for (const event of events) {
    if (event.type !== 'PAIR_DISCARDED') continue;
    if (event.cards.length !== event.pairCount * 2) {
      throw new Error(`${gameLabel}: event pair tidak konsisten`);
    }
    const { pairs } = findPairs(event.cards);
    if (pairs.length !== event.pairCount) {
      throw new Error(`${gameLabel}: kartu yang dibuang bukan pasangan valid`);
    }
  }
}

function simulateGame(playerCount, gameIndex) {
  const label = `game#${gameIndex} (${playerCount} pemain)`;
  const state = createGame({ gameId: label, players: makePlayers(playerCount) });
  const startEvents = startGame(state);
  checkDiscards(startEvents, label);

  let turns = 0;
  while (state.status === 'PLAYING') {
    turns += 1;
    if (turns > MAX_TURNS_PER_GAME) {
      throw new Error(`${label}: DEADLOCK setelah ${MAX_TURNS_PER_GAME} turn`);
    }
    const { currentPlayer, targetPlayer } = getTurnInfo(state);
    if (!currentPlayer || !targetPlayer) {
      throw new Error(`${label}: turn manager tidak menemukan pemain aktif`);
    }
    if (targetPlayer.status !== 'ACTIVE' || targetPlayer.hand.length === 0) {
      throw new Error(`${label}: target draw tidak valid`);
    }
    const before = totalCardsInHands(state) + state.discarded.length;
    const result = drawCard(state, {
      playerId: currentPlayer.playerId,
      cardIndex: randomInt(targetPlayer.hand.length),
    });
    const after = totalCardsInHands(state) + state.discarded.length;
    if (after !== before) throw new Error(`${label}: jumlah kartu berubah saat draw`);
    checkDiscards(result.events, label);
    if (state.status === 'PLAYING' && state.currentPlayerId === currentPlayer.playerId) {
      const next = getTurnInfo(state);
      if (!next || next.currentPlayer.status !== 'ACTIVE') {
        throw new Error(`${label}: turn tidak berpindah dengan benar`);
      }
    }
  }

  checkInvariants(state, label);

  const holders = state.players.filter((player) => player.hand.length > 0);
  if (holders.length !== 1) {
    throw new Error(`${label}: ${holders.length} pemain masih memegang kartu`);
  }
  if (holders[0].playerId !== state.pigHeadPlayerId) {
    throw new Error(`${label}: pig head tidak sesuai pemegang kartu`);
  }
  if (!holders[0].hand.some((card) => card.rank === 'JOKER')) {
    throw new Error(`${label}: pig head tidak memegang Joker`);
  }
  for (const player of state.players) {
    if (player.status === 'OUT' && player.hand.length !== 0) {
      throw new Error(`${label}: pemain OUT masih memegang kartu`);
    }
  }

  return turns;
}

function main() {
  const totalGames = Number(process.argv[2] ?? 1000);
  const minPlayers = Number(process.argv[3] ?? 2);
  const maxPlayers = Math.min(Number(process.argv[4] ?? MAX_PLAYERS), 53);
  if (!Number.isInteger(totalGames) || totalGames < 1) {
    throw new Error('jumlah game harus integer >= 1');
  }

  let totalTurns = 0;
  let maxTurns = 0;
  const startedAt = Date.now();
  const reportEvery = Math.max(1, Math.floor(totalGames / 10));

  for (let i = 1; i <= totalGames; i += 1) {
    const playerCount = minPlayers + randomInt(maxPlayers - minPlayers + 1);
    const turns = simulateGame(playerCount, i);
    totalTurns += turns;
    maxTurns = Math.max(maxTurns, turns);
    if (i % reportEvery === 0 || i === totalGames) {
      console.log(`  ${i}/${totalGames} game selesai`);
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log('');
  console.log(`LULUS: ${totalGames} game, ${minPlayers}-${maxPlayers} pemain`);
  console.log(`Total turn : ${totalTurns}`);
  console.log(`Rata-rata  : ${(totalTurns / totalGames).toFixed(1)} turn/game`);
  console.log(`Terbanyak  : ${maxTurns} turn`);
  console.log(`Durasi     : ${seconds}s`);
}

main();
