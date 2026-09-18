import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextActivePlayer, getActivePlayers } from '../src/game/turnManager.js';

const players = [
  { playerId: 'a', seatNumber: 0, status: 'ACTIVE' },
  { playerId: 'b', seatNumber: 1, status: 'ACTIVE' },
  { playerId: 'c', seatNumber: 2, status: 'ACTIVE' },
  { playerId: 'd', seatNumber: 3, status: 'ACTIVE' },
];

test('giliran berpindah ke seat berikutnya', () => {
  assert.equal(getNextActivePlayer(players, 0).playerId, 'b');
  assert.equal(getNextActivePlayer(players, 2).playerId, 'd');
});

test('giliran berputar kembali ke awal', () => {
  assert.equal(getNextActivePlayer(players, 3).playerId, 'a');
});

test('pemain OUT dilewati', () => {
  const withOut = players.map((p) => (p.playerId === 'c' ? { ...p, status: 'OUT' } : p));
  assert.equal(getNextActivePlayer(withOut, 1).playerId, 'd');
});

test('beberapa pemain OUT dilewati', () => {
  const withOut = players.map((p) => (['b', 'c'].includes(p.playerId) ? { ...p, status: 'OUT' } : p));
  assert.equal(getNextActivePlayer(withOut, 0).playerId, 'd');
});

test('null jika tidak ada pemain aktif', () => {
  const allOut = players.map((p) => ({ ...p, status: 'OUT' }));
  assert.equal(getNextActivePlayer(allOut, 0), null);
});

test('getActivePlayers menyaring status', () => {
  const mixed = players.map((p) => (p.playerId === 'a' ? { ...p, status: 'OUT' } : p));
  assert.deepEqual(getActivePlayers(mixed).map((p) => p.playerId), ['b', 'c', 'd']);
});
