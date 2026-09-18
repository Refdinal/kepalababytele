import test from 'node:test';
import assert from 'node:assert/strict';
import { findPairs, discardPairs } from '../src/game/pairing.js';

const card = (id, rank, suit, color) => ({ id, rank, suit, color });
const joker = { id: 'JOKER', rank: 'JOKER', suit: null, color: null };

test('heart 7 + diamond 7 adalah pasangan', () => {
  const { pairs, remainingCards } = findPairs([
    card('H7', '7', 'HEART', 'RED'),
    card('D7', '7', 'DIAMOND', 'RED'),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(remainingCards.length, 0);
});

test('spade 7 + club 7 adalah pasangan', () => {
  const { pairs } = findPairs([
    card('S7', '7', 'SPADE', 'BLACK'),
    card('C7', '7', 'CLUB', 'BLACK'),
  ]);
  assert.equal(pairs.length, 1);
});

test('heart 7 + spade 7 bukan pasangan', () => {
  const { pairs, remainingCards } = findPairs([
    card('H7', '7', 'HEART', 'RED'),
    card('S7', '7', 'SPADE', 'BLACK'),
  ]);
  assert.equal(pairs.length, 0);
  assert.equal(remainingCards.length, 2);
});

test('heart J + diamond J adalah pasangan', () => {
  const { pairs } = findPairs([
    card('HJ', 'J', 'HEART', 'RED'),
    card('DJ', 'J', 'DIAMOND', 'RED'),
  ]);
  assert.equal(pairs.length, 1);
});

test('spade K + club K adalah pasangan', () => {
  const { pairs } = findPairs([
    card('SK', 'K', 'SPADE', 'BLACK'),
    card('CK', 'K', 'CLUB', 'BLACK'),
  ]);
  assert.equal(pairs.length, 1);
});

test('joker tidak pernah berpasangan', () => {
  const { pairs, remainingCards } = findPairs([
    joker,
    card('H7', '7', 'HEART', 'RED'),
    card('D7', '7', 'DIAMOND', 'RED'),
  ]);
  assert.equal(pairs.length, 1);
  assert.deepEqual(remainingCards, [joker]);
});

test('dua warna dari rank yang sama membentuk dua pasangan', () => {
  const { pairs, remainingCards } = findPairs([
    card('H7', '7', 'HEART', 'RED'),
    card('D7', '7', 'DIAMOND', 'RED'),
    card('S7', '7', 'SPADE', 'BLACK'),
    card('C7', '7', 'CLUB', 'BLACK'),
  ]);
  assert.equal(pairs.length, 2);
  assert.equal(remainingCards.length, 0);
});

test('kartu tanpa pasangan tetap di tangan', () => {
  const { pairs, remainingCards } = findPairs([
    card('H3', '3', 'HEART', 'RED'),
    card('S9', '9', 'SPADE', 'BLACK'),
    joker,
  ]);
  assert.equal(pairs.length, 0);
  assert.equal(remainingCards.length, 3);
});

test('discardPairs mengembalikan kartu yang dibuang', () => {
  const { discarded, remainingCards } = discardPairs([
    card('HK', 'K', 'HEART', 'RED'),
    card('DK', 'K', 'DIAMOND', 'RED'),
    card('S2', '2', 'SPADE', 'BLACK'),
  ]);
  assert.equal(discarded.length, 2);
  assert.equal(remainingCards.length, 1);
  assert.equal(remainingCards[0].id, 'S2');
});
