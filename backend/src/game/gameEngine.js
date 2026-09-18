import { GameError } from './errors.js';
import { createShuffledDeck } from './deck.js';
import { dealCards } from './dealing.js';
import { discardPairs } from './pairing.js';
import { getNextActivePlayer, getActivePlayers } from './turnManager.js';
import { secureShuffle } from './shuffle.js';

function pushEvent(events, type, payload = {}) {
  events.push({ type, ...payload });
}

function normalizePlayer(player, index) {
  return {
    playerId: String(player.playerId),
    telegramUserId: player.telegramUserId ?? null,
    username: player.username ?? null,
    displayName: player.displayName ?? `Player ${index + 1}`,
    seatNumber: player.seatNumber ?? index,
    status: 'ACTIVE',
    hand: [],
  };
}

function finishGame(state, pigHead, events) {
  state.status = 'FINISHED';
  state.currentPlayerId = null;
  state.pigHeadPlayerId = pigHead ? pigHead.playerId : null;
  state.finishedAt = new Date().toISOString();
  if (pigHead) {
    pushEvent(events, 'PIG_HEAD_SELECTED', { playerId: pigHead.playerId });
  }
  pushEvent(events, 'GAME_FINISHED', { pigHeadPlayerId: state.pigHeadPlayerId });
}

export function createLobby({ gameId, chatId = null, hostPlayerId = null, players = [] }) {
  const seen = new Set();
  const normalized = players.map((player, index) => {
    const value = normalizePlayer(player, index);
    if (seen.has(value.playerId)) throw new GameError('PLAYER_ALREADY_JOINED');
    seen.add(value.playerId);
    return value;
  });
  return {
    gameId,
    chatId,
    hostPlayerId: hostPlayerId !== null ? String(hostPlayerId) : normalized[0]?.playerId ?? null,
    status: 'WAITING',
    currentPlayerId: null,
    turnNumber: 0,
    pigHeadPlayerId: null,
    startedAt: null,
    finishedAt: null,
    discarded: [],
    players: normalized,
  };
}

export function createGame(options) {
  if ((options.players ?? []).length < 2) throw new GameError('NOT_ENOUGH_PLAYERS');
  return createLobby(options);
}

export function addPlayer(state, player) {
  if (state.status !== 'WAITING') throw new GameError('JOIN_CLOSED');
  const value = normalizePlayer(player, state.players.length);
  if (state.players.some((p) => p.playerId === value.playerId)) {
    throw new GameError('PLAYER_ALREADY_JOINED');
  }
  state.players.push(value);
  return value;
}

export function startGame(state) {
  if (state.status !== 'WAITING') throw new GameError('GAME_ALREADY_STARTED');
  if (state.players.length < 2) throw new GameError('NOT_ENOUGH_PLAYERS');

  const deck = createShuffledDeck();
  const hands = dealCards(deck, state.players.length);
  const events = [];

  state.players.forEach((player, index) => {
    const { pairs, remainingCards } = discardPairs(hands[index]);
    player.hand = remainingCards;
    if (pairs.length > 0) {
      state.discarded.push(...pairs.flat());
      pushEvent(events, 'PAIR_DISCARDED', {
        playerId: player.playerId,
        cards: pairs.flat(),
        pairCount: pairs.length,
      });
    }
    if (player.hand.length === 0) {
      player.status = 'OUT';
      pushEvent(events, 'PLAYER_OUT', { playerId: player.playerId });
    }
  });

  state.status = 'PLAYING';
  state.turnNumber = 1;
  state.startedAt = new Date().toISOString();
  pushEvent(events, 'GAME_STARTED', { playerCount: state.players.length });

  const active = getActivePlayers(state.players);
  if (active.length <= 1) {
    finishGame(state, active[0] ?? null, events);
  } else {
    const first = [...active].sort((a, b) => a.seatNumber - b.seatNumber)[0];
    state.currentPlayerId = first.playerId;
    pushEvent(events, 'TURN_CHANGED', {
      currentPlayerId: first.playerId,
      turnNumber: state.turnNumber,
    });
  }

  return events;
}

export function drawCard(state, { playerId, cardIndex }) {
  if (state.status === 'FINISHED') throw new GameError('GAME_FINISHED');
  if (state.status !== 'PLAYING') throw new GameError('GAME_NOT_PLAYING');

  const id = String(playerId);
  const current = state.players.find((p) => p.playerId === id);
  if (!current) throw new GameError('PLAYER_NOT_IN_GAME');
  if (state.currentPlayerId !== id) throw new GameError('NOT_YOUR_TURN');
  if (current.status !== 'ACTIVE') throw new GameError('NOT_YOUR_TURN');

  const target = getNextActivePlayer(state.players, current.seatNumber);
  if (!target || target.playerId === current.playerId) throw new GameError('INVALID_TARGET');
  if (target.status !== 'ACTIVE') throw new GameError('TARGET_NOT_ACTIVE');
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= target.hand.length) {
    throw new GameError('INVALID_CARD_INDEX');
  }

  const events = [];
  const handBefore = current.hand.length;

  target.hand = secureShuffle(target.hand);
  const [drawn] = target.hand.splice(cardIndex, 1);
  current.hand.push(drawn);

  pushEvent(events, 'CARD_DRAWN', {
    playerId: current.playerId,
    targetPlayerId: target.playerId,
    card: drawn,
    cardIndex,
  });

  const { pairs, remainingCards } = discardPairs(current.hand);
  current.hand = remainingCards;
  if (pairs.length > 0) {
    state.discarded.push(...pairs.flat());
    pushEvent(events, 'PAIR_DISCARDED', {
      playerId: current.playerId,
      cards: pairs.flat(),
      pairCount: pairs.length,
    });
  }

  if (target.hand.length === 0 && target.status === 'ACTIVE') {
    target.status = 'OUT';
    pushEvent(events, 'PLAYER_OUT', { playerId: target.playerId });
  }
  if (current.hand.length === 0 && current.status === 'ACTIVE') {
    current.status = 'OUT';
    pushEvent(events, 'PLAYER_OUT', { playerId: current.playerId });
  }

  const active = getActivePlayers(state.players);
  if (active.length <= 1) {
    finishGame(state, active[0] ?? null, events);
  } else {
    const next = getNextActivePlayer(state.players, current.seatNumber);
    state.currentPlayerId = next.playerId;
    state.turnNumber += 1;
    pushEvent(events, 'TURN_CHANGED', {
      currentPlayerId: next.playerId,
      turnNumber: state.turnNumber,
    });
  }

  return {
    card: drawn,
    pairs,
    events,
    handBefore,
    handAfter: current.hand.length,
  };
}

export function getPlayer(state, playerId) {
  return state.players.find((p) => p.playerId === String(playerId)) ?? null;
}

export function getTurnInfo(state) {
  if (state.status !== 'PLAYING') return null;
  const current = getPlayer(state, state.currentPlayerId);
  const target = current ? getNextActivePlayer(state.players, current.seatNumber) : null;
  return { currentPlayer: current, targetPlayer: target };
}

export function getPublicState(state) {
  return {
    gameId: state.gameId,
    chatId: state.chatId,
    hostPlayerId: state.hostPlayerId,
    status: state.status,
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    pigHeadPlayerId: state.pigHeadPlayerId,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    players: state.players.map((player) => ({
      playerId: player.playerId,
      telegramUserId: player.telegramUserId,
      username: player.username,
      displayName: player.displayName,
      seatNumber: player.seatNumber,
      status: player.status,
      cardCount: player.hand.length,
    })),
  };
}

export function totalCardsInHands(state) {
  return state.players.reduce((sum, player) => sum + player.hand.length, 0);
}

export function getDiscardedCards(state) {
  return state.discarded ?? [];
}
