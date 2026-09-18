import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import {
  resetMemoryStore,
  createRoom,
  joinRoom,
  loadGame,
  getActiveGameByChat,
  startGameById,
  drawCardByTelegramId,
  cancelRoom,
  setLobbyMessageId,
  setDmMessageId,
  getDmMessageId,
} from '../src/services/memoryStore.js';
import { getTurnInfo } from '../src/game/gameEngine.js';

function user(id, name) {
  return { id, first_name: name, username: `user${id}` };
}

function asFrom(player) {
  return { id: Number(player.playerId), first_name: player.displayName, username: player.username };
}

test('flow room + game lengkap tanpa database', async () => {
  resetMemoryStore();
  const host = user(1, 'Andi');
  const room = await createRoom({ chatId: -100, from: host });
  assert.equal(room.status, 'WAITING');

  await joinRoom(room.id, user(2, 'Budi'));
  await joinRoom(room.id, user(3, 'Citra'));
  const loaded = await loadGame(room.id);
  assert.equal(loaded.state.players.length, 3);
  assert.equal(loaded.game.lobby_message_id, null);

  await assert.rejects(joinRoom(room.id, user(2, 'Budi')), /sudah bergabung/i);
  await assert.rejects(startGameById(room.id, user(2, 'Budi')), /host/i);

  const active = await getActiveGameByChat(-100);
  assert.equal(active.id, room.id);

  const { state } = await startGameById(room.id, host);
  assert.equal(state.status, 'PLAYING');
  await assert.rejects(joinRoom(room.id, user(4, 'Dodi')), /join/i);

  let guard = 0;
  while (state.status === 'PLAYING') {
    guard += 1;
    if (guard > 200000) throw new Error('DEADLOCK');
    const { currentPlayer, targetPlayer } = getTurnInfo(state);
    await drawCardByTelegramId(room.id, asFrom(currentPlayer), randomInt(targetPlayer.hand.length));
  }

  const holders = state.players.filter((player) => player.hand.length > 0);
  assert.equal(holders.length, 1);
  assert.equal(holders[0].playerId, state.pigHeadPlayerId);
  assert.ok(holders[0].hand.some((card) => card.rank === 'JOKER'));
  assert.equal(await getActiveGameByChat(-100), null);
});

test('createRoom ditolak bila ada game aktif di chat', async () => {
  resetMemoryStore();
  await createRoom({ chatId: -300, from: user(20, 'Host') });
  await assert.rejects(createRoom({ chatId: -300, from: user(21, 'Lain') }), /game aktif/i);
});

test('cancel room hanya oleh host dan hanya saat WAITING', async () => {
  resetMemoryStore();
  const host = user(10, 'Host');
  const room = await createRoom({ chatId: -200, from: host });
  await setLobbyMessageId(room.id, 555);
  await setDmMessageId(room.id, 10, 777);
  assert.equal(await getDmMessageId(room.id, 10), 777);

  await assert.rejects(cancelRoom(room.id, user(11, 'Bukan Host')), /host/i);
  const canceled = await cancelRoom(room.id, host);
  assert.equal(canceled.status, 'CANCELLED');
  assert.equal(await getActiveGameByChat(-200), null);
  await assert.rejects(cancelRoom(room.id, host), /dimulai/i);
});

test('draw di luar giliran ditolak lewat store', async () => {
  resetMemoryStore();
  const host = user(30, 'Host');
  const room = await createRoom({ chatId: -400, from: host });
  await joinRoom(room.id, user(31, 'Teman'));
  const { state } = await startGameById(room.id, host);
  const notCurrent = state.players.find((player) => player.playerId !== state.currentPlayerId);
  await assert.rejects(
    drawCardByTelegramId(room.id, asFrom(notCurrent), 0),
    /giliran/i,
  );
});
