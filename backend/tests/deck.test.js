import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, createShuffledDeck } from '../src/game/deck.js';
import { SUITS, RANKS, cardFromCode, formatCard } from '../src/game/cards.js';

test('deck berisi 53 kartu', () => {
  assert.equal(createDeck().length, 53);
});

test('deck berisi 52 kartu standar + 1 joker', () => {
  const deck = createDeck();
  const jokers = deck.filter((card) => card.rank === 'JOKER');
  const standard = deck.filter((card) => card.rank !== 'JOKER');
  assert.equal(jokers.length, 1);
  assert.equal(jokers[0].id, 'JOKER');
  assert.equal(jokers[0].suit, null);
  assert.equal(jokers[0].color, null);
  assert.equal(standard.length, SUITS.length * RANKS.length);
});

test('semua card id unik', () => {
  const deck = createDeck();
  const ids = new Set(deck.map((card) => card.id));
  assert.equal(ids.size, deck.length);
});

test('setiap suit memiliki seluruh rank', () => {
  const deck = createDeck();
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const found = deck.find((card) => card.id === `${suit.code}${rank}`);
      assert.ok(found, `kartu ${suit.code}${rank} tidak ditemukan`);
      assert.equal(found.suit, suit.suit);
      assert.equal(found.color, suit.color);
      assert.equal(found.rank, rank);
    }
  }
});

test('shuffle mempertahankan semua kartu', () => {
  const shuffled = createShuffledDeck();
  assert.equal(shuffled.length, 53);
  const ids = new Set(shuffled.map((card) => card.id));
  assert.equal(ids.size, 53);
});

test('cardFromCode mengembalikan kartu yang sama dengan deck', () => {
  for (const card of createDeck()) {
    assert.deepEqual(cardFromCode(card.id), card);
  }
  assert.throws(() => cardFromCode('XX9'), /tidak valid/);
  assert.throws(() => cardFromCode('H1'), /tidak valid/);
});

test('formatCard menampilkan simbol yang benar', () => {
  assert.equal(formatCard(cardFromCode('H7')), '\u26657');
  assert.equal(formatCard(cardFromCode('D10')), '\u266610');
  assert.equal(formatCard(cardFromCode('JOKER')), 'JOKER');
});

test('shuffle mengubah urutan deck', () => {
  const original = createDeck().map((card) => card.id).join(',');
  let different = false;
  for (let i = 0; i < 5 && !different; i += 1) {
    const shuffled = createShuffledDeck().map((card) => card.id).join(',');
    if (shuffled !== original) different = true;
  }
  assert.ok(different);
});
