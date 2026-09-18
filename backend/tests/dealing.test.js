import test from 'node:test';
import assert from 'node:assert/strict';
import { createShuffledDeck } from '../src/game/deck.js';
import { dealCards } from '../src/game/dealing.js';

const PLAYER_COUNTS = [2, 3, 4, 5, 10, 11, 20, 53];

test('semua kartu dibagikan tepat sekali', () => {
  const deck = createShuffledDeck();
  for (const count of PLAYER_COUNTS) {
    const hands = dealCards(deck, count);
    const dealt = hands.flat();
    assert.equal(dealt.length, deck.length, `jumlah kartu salah untuk ${count} pemain`);
    assert.equal(new Set(dealt.map((c) => c.id)).size, deck.length);
  }
});

test('selisih jumlah kartu antar pemain maksimal 1', () => {
  const deck = createShuffledDeck();
  for (const count of PLAYER_COUNTS) {
    const hands = dealCards(deck, count);
    const sizes = hands.map((hand) => hand.length);
    const diff = Math.max(...sizes) - Math.min(...sizes);
    assert.ok(diff <= 1, `selisih ${diff} untuk ${count} pemain`);
  }
});

test('contoh distribusi sesuai aturan', () => {
  const deck = createShuffledDeck();
  assert.deepEqual(dealCards(deck, 2).map((h) => h.length), [27, 26]);
  assert.deepEqual(dealCards(deck, 3).map((h) => h.length), [18, 18, 17]);
  assert.deepEqual(dealCards(deck, 4).map((h) => h.length), [14, 13, 13, 13]);
  assert.deepEqual(dealCards(deck, 5).map((h) => h.length), [11, 11, 11, 10, 10]);
});
