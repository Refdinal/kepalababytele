import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import {
  createGame,
  addPlayer,
  startGame,
  drawCard,
  getPlayer,
  getTurnInfo,
  getPublicState,
  totalCardsInHands,
} from '../src/game/gameEngine.js';
import { findPairs } from '../src/game/pairing.js';

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `p${index + 1}`,
    telegramUserId: 1000 + index,
    displayName: `Player ${index + 1}`,
  }));
}

function playRandomGame(playerCount) {
  const state = createGame({ gameId: 'test-game', players: makePlayers(playerCount) });
  startGame(state);
  let turns = 0;
  while (state.status === 'PLAYING') {
    turns += 1;
    if (turns > 200000) throw new Error('DEADLOCK');
    const { currentPlayer, targetPlayer } = getTurnInfo(state);
    const index = randomInt(targetPlayer.hand.length);
    drawCard(state, { playerId: currentPlayer.playerId, cardIndex: index });
  }
  return { state, turns };
}

test('createGame menolak kurang dari 2 pemain', () => {
  assert.throws(
    () => createGame({ gameId: 'g', players: makePlayers(1) }),
    (err) => err.code === 'NOT_ENOUGH_PLAYERS',
  );
});

test('createGame menolak player duplikat', () => {
  const duplicate = [makePlayers(1)[0], makePlayers(1)[0]];
  assert.throws(
    () => createGame({ gameId: 'g', players: duplicate }),
    (err) => err.code === 'PLAYER_ALREADY_JOINED',
  );
});

test('addPlayer hanya bisa saat WAITING', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(2) });
  addPlayer(state, { playerId: 'p3', displayName: 'Player 3' });
  assert.equal(state.players.length, 3);
  startGame(state);
  assert.throws(
    () => addPlayer(state, { playerId: 'p4', displayName: 'Player 4' }),
    (err) => err.code === 'JOIN_CLOSED',
  );
});

test('startGame membagikan semua 53 kartu dan membuang pasangan awal', () => {
  for (let count = 2; count <= 8; count += 1) {
    const state = createGame({ gameId: 'g', players: makePlayers(count) });
    startGame(state);
    assert.equal(state.status, 'PLAYING');
    assert.equal(totalCardsInHands(state) + state.discarded.length, 53);
    for (const player of state.players) {
      const { pairs } = findPairs(player.hand);
      assert.equal(pairs.length, 0, `pasangan tersisa di tangan ${player.playerId}`);
      if (player.status === 'OUT') assert.equal(player.hand.length, 0);
      if (player.status === 'ACTIVE') assert.ok(player.hand.length > 0);
    }
  }
});

test('startGame dipanggil dua kali ditolak', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(3) });
  startGame(state);
  assert.throws(() => startGame(state), (err) => err.code === 'GAME_ALREADY_STARTED');
});

test('pemain di luar giliran tidak bisa draw', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(3) });
  startGame(state);
  const notCurrent = state.players.find((p) => p.playerId !== state.currentPlayerId);
  assert.throws(
    () => drawCard(state, { playerId: notCurrent.playerId, cardIndex: 0 }),
    (err) => err.code === 'NOT_YOUR_TURN',
  );
});

test('card index invalid ditolak', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(3) });
  startGame(state);
  const currentId = state.currentPlayerId;
  assert.throws(
    () => drawCard(state, { playerId: currentId, cardIndex: -1 }),
    (err) => err.code === 'INVALID_CARD_INDEX',
  );
  assert.throws(
    () => drawCard(state, { playerId: currentId, cardIndex: 999 }),
    (err) => err.code === 'INVALID_CARD_INDEX',
  );
  assert.throws(
    () => drawCard(state, { playerId: currentId, cardIndex: 1.5 }),
    (err) => err.code === 'INVALID_CARD_INDEX',
  );
});

test('draw memindahkan tepat satu kartu dan menjaga invariant 53', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(4) });
  startGame(state);
  const { currentPlayer, targetPlayer } = getTurnInfo(state);
  const targetBefore = targetPlayer.hand.length;
  const currentBefore = currentPlayer.hand.length;
  const before = totalCardsInHands(state) + state.discarded.length;
  const result = drawCard(state, { playerId: currentPlayer.playerId, cardIndex: 0 });
  const after = totalCardsInHands(state) + state.discarded.length;
  assert.equal(before, 53);
  assert.equal(after, 53);
  assert.ok(result.card);
  assert.equal(targetPlayer.hand.length, targetBefore - 1);
  assert.equal(currentPlayer.hand.length + result.pairs.length * 2, currentBefore + 1);
});

test('game selalu selesai, pig head memegang joker, tepat satu pemegang kartu', () => {
  for (let count = 2; count <= 7; count += 1) {
    const { state } = playRandomGame(count);
    assert.equal(state.status, 'FINISHED');
    const holders = state.players.filter((p) => p.hand.length > 0);
    assert.equal(holders.length, 1);
    assert.equal(holders[0].playerId, state.pigHeadPlayerId);
    assert.ok(holders[0].hand.some((card) => card.rank === 'JOKER'));
    assert.equal(totalCardsInHands(state) + state.discarded.length, 53);
    const allCards = [...state.players.flatMap((p) => p.hand), ...state.discarded];
    assert.equal(allCards.length, 53);
    assert.equal(new Set(allCards.map((card) => card.id)).size, 53);
  }
});

test('draw setelah game selesai ditolak', () => {
  const { state } = playRandomGame(2);
  const anyPlayer = state.players[0];
  assert.throws(
    () => drawCard(state, { playerId: anyPlayer.playerId, cardIndex: 0 }),
    (err) => err.code === 'GAME_FINISHED',
  );
});

test('getPublicState tidak membocorkan kartu', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(3) });
  startGame(state);
  const publicState = getPublicState(state);
  for (const player of publicState.players) {
    assert.equal(player.hand, undefined);
    assert.equal(typeof player.cardCount, 'number');
  }
});

test('target draw selalu pemain ACTIVE berikutnya', () => {
  const state = createGame({ gameId: 'g', players: makePlayers(5) });
  startGame(state);
  for (let i = 0; i < 50 && state.status === 'PLAYING'; i += 1) {
    const { currentPlayer, targetPlayer } = getTurnInfo(state);
    assert.equal(targetPlayer.status, 'ACTIVE');
    assert.notEqual(targetPlayer.playerId, currentPlayer.playerId);
    assert.ok(targetPlayer.hand.length > 0);
    const index = randomInt(targetPlayer.hand.length);
    drawCard(state, { playerId: currentPlayer.playerId, cardIndex: index });
  }
  assert.ok(getPlayer(state, state.currentPlayerId) || state.status === 'FINISHED');
});
