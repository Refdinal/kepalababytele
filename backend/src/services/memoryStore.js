import { randomUUID } from 'node:crypto';
import { GameError } from '../game/errors.js';
import {
  createLobby,
  addPlayer,
  startGame as engineStartGame,
  drawCard as engineDrawCard,
} from '../game/gameEngine.js';

const games = new Map();
const users = new Map();

export function resetMemoryStore() {
  games.clear();
  users.clear();
}

function displayNameOf(from) {
  const full = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  return full || from.username || null;
}

function getRecord(gameId) {
  const record = games.get(String(gameId));
  if (!record) throw new GameError('GAME_NOT_FOUND');
  return record;
}

function publicGame(record) {
  return {
    id: record.id,
    chat_id: record.chatId,
    host_user_id: record.hostTelegramId,
    status: record.state.status,
    lobby_message_id: record.lobbyMessageId,
    created_at: record.createdAt,
    started_at: record.state.startedAt,
    finished_at: record.state.finishedAt,
  };
}

export async function upsertUser(from) {
  const key = String(from.id);
  const user = {
    id: Number(from.id),
    telegram_user_id: from.id,
    username: from.username ?? null,
    first_name: from.first_name ?? null,
    last_name: from.last_name ?? null,
    updated_at: new Date().toISOString(),
  };
  users.set(key, user);
  return user;
}

export async function createRoom({ chatId, from }) {
  await upsertUser(from);
  const active = await getActiveGameByChat(chatId);
  if (active) throw new GameError('GAME_ALREADY_ACTIVE');

  const id = randomUUID();
  const state = createLobby({
    gameId: id,
    chatId: String(chatId),
    hostPlayerId: String(from.id),
    players: [
      {
        playerId: String(from.id),
        telegramUserId: from.id,
        username: from.username ?? null,
        displayName: displayNameOf(from),
      },
    ],
  });
  const record = {
    id,
    chatId: String(chatId),
    hostTelegramId: String(from.id),
    lobbyMessageId: null,
    createdAt: new Date().toISOString(),
    state,
    dmMessageIds: new Map(),
  };
  games.set(id, record);
  return publicGame(record);
}

export async function joinRoom(gameId, from) {
  const record = getRecord(gameId);
  if (record.state.status !== 'WAITING') throw new GameError('JOIN_CLOSED');
  addPlayer(record.state, {
    playerId: String(from.id),
    telegramUserId: from.id,
    username: from.username ?? null,
    displayName: displayNameOf(from),
  });
  return publicGame(record);
}

export async function loadGame(gameId) {
  const record = getRecord(gameId);
  return { game: publicGame(record), playerRows: [], state: record.state };
}

export async function getActiveGameByChat(chatId) {
  for (const record of games.values()) {
    const isActive = record.state.status === 'WAITING' || record.state.status === 'PLAYING';
    if (isActive && String(record.chatId) === String(chatId)) return publicGame(record);
  }
  return null;
}

export async function getGameById(gameId) {
  return publicGame(getRecord(gameId));
}

export async function startGameById(gameId, from) {
  const record = getRecord(gameId);
  if (String(from.id) !== record.hostTelegramId) throw new GameError('NOT_HOST');
  if (record.state.status !== 'WAITING') throw new GameError('GAME_ALREADY_STARTED');
  const events = engineStartGame(record.state);
  return { state: record.state, events, playerRows: [], game: publicGame(record) };
}

export async function drawCardByTelegramId(gameId, from, cardIndex) {
  const record = getRecord(gameId);
  if (record.state.status === 'FINISHED' || record.state.status === 'CANCELLED') {
    throw new GameError('GAME_FINISHED');
  }
  if (record.state.status !== 'PLAYING') throw new GameError('GAME_NOT_PLAYING');
  const result = engineDrawCard(record.state, { playerId: String(from.id), cardIndex });
  return { state: record.state, result, playerRows: [] };
}

export async function cancelRoom(gameId, from) {
  const record = getRecord(gameId);
  if (String(from.id) !== record.hostTelegramId) throw new GameError('NOT_HOST');
  if (record.state.status !== 'WAITING') throw new GameError('GAME_ALREADY_STARTED');
  record.state.status = 'CANCELLED';
  record.state.finishedAt = new Date().toISOString();
  return publicGame(record);
}

export async function setLobbyMessageId(gameId, messageId) {
  getRecord(gameId).lobbyMessageId = messageId;
}

export async function setDmMessageId(gameId, telegramUserId, messageId) {
  getRecord(gameId).dmMessageIds.set(String(telegramUserId), messageId);
}

export async function getDmMessageId(gameId, telegramUserId) {
  return getRecord(gameId).dmMessageIds.get(String(telegramUserId)) ?? null;
}
