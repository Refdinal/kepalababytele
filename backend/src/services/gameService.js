import { pool, withTransaction } from '../db/pool.js';
import { GameError } from '../game/errors.js';
import { startGame as engineStartGame, drawCard as engineDrawCard } from '../game/gameEngine.js';
import { cardFromCode } from '../game/cards.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function displayName(player) {
  const full = [player.first_name, player.last_name].filter(Boolean).join(' ').trim();
  return full || player.username || `Player ${player.seat_number + 1}`;
}

function buildEngineState(game, playerRows, cardRows) {
  const userIdByTelegram = new Map();
  const players = playerRows.map((row) => {
    userIdByTelegram.set(String(row.telegram_user_id), String(row.user_id));
    return {
      playerId: String(row.telegram_user_id),
      telegramUserId: row.telegram_user_id,
      username: row.username,
      displayName: displayName(row),
      seatNumber: row.seat_number,
      status: row.status,
      hand: [],
    };
  });
  const playerByTelegram = new Map(players.map((player) => [player.playerId, player]));

  const discarded = [];
  for (const card of cardRows) {
    const cardObject = cardFromCode(card.card_code);
    if (card.status === 'DISCARDED') {
      discarded.push(cardObject);
    } else {
      const owner = playerByTelegram.get(String(card.player_id ?? ''));
      if (owner) owner.hand.push(cardObject);
    }
  }

  const telegramByUserId = new Map();
  for (const [telegramId, userId] of userIdByTelegram.entries()) {
    telegramByUserId.set(userId, telegramId);
  }

  return {
    gameId: game.id,
    chatId: game.chat_id !== null && game.chat_id !== undefined ? String(game.chat_id) : null,
    hostPlayerId: telegramByUserId.get(String(game.host_user_id)) ?? null,
    status: game.status,
    currentPlayerId: game.current_player_id ? telegramByUserId.get(String(game.current_player_id)) ?? null : null,
    turnNumber: game.turn_number,
    pigHeadPlayerId: game.pig_head_player_id ? telegramByUserId.get(String(game.pig_head_player_id)) ?? null : null,
    startedAt: game.started_at ? new Date(game.started_at).toISOString() : null,
    finishedAt: game.finished_at ? new Date(game.finished_at).toISOString() : null,
    discarded,
    players,
  };
}

async function lockGame(client, gameId) {
  if (!UUID_RE.test(String(gameId))) throw new GameError('GAME_NOT_FOUND');
  const { rows } = await client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [gameId]);
  if (rows.length === 0) throw new GameError('GAME_NOT_FOUND');
  return rows[0];
}

async function fetchPlayerRows(client, gameId) {
  const { rows } = await client.query(
    `SELECT gp.*, u.telegram_user_id, u.username, u.first_name, u.last_name
     FROM game_players gp
     JOIN users u ON u.id = gp.user_id
     WHERE gp.game_id = $1
     ORDER BY gp.seat_number`,
    [gameId],
  );
  return rows;
}

async function fetchCardRows(client, gameId) {
  const { rows } = await client.query(
    'SELECT card_code, player_id, status FROM game_cards WHERE game_id = $1 ORDER BY id',
    [gameId],
  );
  return rows;
}

async function persistState(client, state, playerRows) {
  const userIdByPlayer = new Map(playerRows.map((row) => [String(row.telegram_user_id), row.user_id]));
  const userIdOf = (playerId) => (playerId === null || playerId === undefined ? null : userIdByPlayer.get(String(playerId)) ?? null);

  await client.query(
    `UPDATE games
     SET status = $2, current_player_id = $3, turn_number = $4, pig_head_player_id = $5,
         started_at = $6, finished_at = $7
     WHERE id = $1`,
    [
      state.gameId,
      state.status,
      userIdOf(state.currentPlayerId),
      state.turnNumber,
      userIdOf(state.pigHeadPlayerId),
      state.startedAt,
      state.finishedAt,
    ],
  );

  const playerUserIds = [];
  const playerStatuses = [];
  const playerCounts = [];
  for (const player of state.players) {
    playerUserIds.push(userIdOf(player.playerId));
    playerStatuses.push(player.status);
    playerCounts.push(player.hand.length);
  }
  await client.query(
    `UPDATE game_players AS gp
     SET status = v.status,
         card_count = v.card_count,
         finished_at = CASE WHEN v.status = 'OUT' THEN COALESCE(gp.finished_at, now()) ELSE gp.finished_at END
     FROM (
       SELECT UNNEST($2::bigint[]) AS user_id,
              UNNEST($3::text[]) AS status,
              UNNEST($4::int[]) AS card_count
     ) AS v
     WHERE gp.game_id = $1 AND gp.user_id = v.user_id`,
    [state.gameId, playerUserIds, playerStatuses, playerCounts],
  );

  const cardCodes = [];
  const cardOwners = [];
  const cardStatuses = [];
  for (const player of state.players) {
    const ownerId = userIdOf(player.playerId);
    for (const card of player.hand) {
      cardCodes.push(card.id);
      cardOwners.push(ownerId);
      cardStatuses.push('IN_HAND');
    }
  }
  for (const card of state.discarded) {
    cardCodes.push(card.id);
    cardOwners.push(null);
    cardStatuses.push('DISCARDED');
  }
  await client.query(
    `INSERT INTO game_cards (game_id, card_code, player_id, status)
     SELECT $1, v.card_code, v.player_id, v.status
     FROM (
       SELECT UNNEST($2::text[]) AS card_code,
              UNNEST($3::bigint[]) AS player_id,
              UNNEST($4::text[]) AS status
     ) AS v
     ON CONFLICT (game_id, card_code)
     DO UPDATE SET player_id = EXCLUDED.player_id, status = EXCLUDED.status`,
    [state.gameId, cardCodes, cardOwners, cardStatuses],
  );
}

export async function upsertUser(from) {
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_user_id, username, first_name, last_name, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (telegram_user_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           updated_at = now()
     RETURNING *`,
    [from.id, from.username ?? null, from.first_name ?? null, from.last_name ?? null],
  );
  return rows[0];
}

export async function createRoom({ chatId, from }) {
  const user = await upsertUser(from);
  return withTransaction(async (client) => {
    const active = await client.query(
      `SELECT id FROM games
       WHERE chat_id = $1 AND status IN ('WAITING', 'PLAYING')
       ORDER BY created_at DESC LIMIT 1`,
      [chatId],
    );
    if (active.rowCount > 0) throw new GameError('GAME_ALREADY_ACTIVE');

    const { rows } = await client.query(
      `INSERT INTO games (chat_id, host_user_id, status) VALUES ($1, $2, 'WAITING') RETURNING *`,
      [chatId, user.id],
    );
    await client.query(
      'INSERT INTO game_players (game_id, user_id, seat_number) VALUES ($1, $2, 0)',
      [rows[0].id, user.id],
    );
    return rows[0];
  });
}

export async function joinRoom(gameId, from) {
  const user = await upsertUser(from);
  return withTransaction(async (client) => {
    const game = await lockGame(client, gameId);
    if (game.status !== 'WAITING') throw new GameError('JOIN_CLOSED');
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM game_players WHERE game_id = $1',
      [gameId],
    );
    try {
      await client.query(
        'INSERT INTO game_players (game_id, user_id, seat_number) VALUES ($1, $2, $3)',
        [gameId, user.id, rows[0].count],
      );
    } catch (error) {
      if (error.code === '23505') throw new GameError('PLAYER_ALREADY_JOINED');
      throw error;
    }
    return game;
  });
}

export async function loadGame(gameId, client = pool) {
  if (!UUID_RE.test(String(gameId))) throw new GameError('GAME_NOT_FOUND');
  const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
  if (gameResult.rowCount === 0) throw new GameError('GAME_NOT_FOUND');
  const game = gameResult.rows[0];
  const playerRows = await fetchPlayerRows(client, gameId);
  const cardRows = await fetchCardRows(client, gameId);
  return { game, playerRows, state: buildEngineState(game, playerRows, cardRows) };
}

export async function getActiveGameByChat(chatId) {
  const { rows } = await pool.query(
    `SELECT * FROM games
     WHERE chat_id = $1 AND status IN ('WAITING', 'PLAYING')
     ORDER BY created_at DESC LIMIT 1`,
    [chatId],
  );
  return rows[0] ?? null;
}

export async function getGameById(gameId) {
  if (!UUID_RE.test(String(gameId))) throw new GameError('GAME_NOT_FOUND');
  const { rows } = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
  if (rows.length === 0) throw new GameError('GAME_NOT_FOUND');
  return rows[0];
}

export async function startGameById(gameId, from) {
  const user = await upsertUser(from);
  return withTransaction(async (client) => {
    const game = await lockGame(client, gameId);
    if (game.host_user_id !== user.id) throw new GameError('NOT_HOST');
    if (game.status !== 'WAITING') throw new GameError('GAME_ALREADY_STARTED');
    const playerRows = await fetchPlayerRows(client, gameId);
    if (playerRows.length < 2) throw new GameError('NOT_ENOUGH_PLAYERS');

    const state = buildEngineState(game, playerRows, []);
    const events = engineStartGame(state);
    await persistState(client, state, playerRows);
    return { state, events, playerRows, game };
  });
}

export async function drawCardByTelegramId(gameId, from, cardIndex) {
  const user = await upsertUser(from);
  return withTransaction(async (client) => {
    const game = await lockGame(client, gameId);
    if (game.status === 'FINISHED' || game.status === 'CANCELLED') throw new GameError('GAME_FINISHED');
    if (game.status !== 'PLAYING') throw new GameError('GAME_NOT_PLAYING');

    const playerRows = await fetchPlayerRows(client, gameId);
    const cardRows = await fetchCardRows(client, gameId);
    const state = buildEngineState(game, playerRows, cardRows);
    const result = engineDrawCard(state, { playerId: String(from.id), cardIndex });
    await persistState(client, state, playerRows);
    return { state, result, playerRows, userId: user.id };
  });
}

export async function cancelRoom(gameId, from) {
  const user = await upsertUser(from);
  return withTransaction(async (client) => {
    const game = await lockGame(client, gameId);
    if (game.host_user_id !== user.id) throw new GameError('NOT_HOST');
    if (game.status !== 'WAITING') throw new GameError('GAME_ALREADY_STARTED');
    await client.query(`UPDATE games SET status = 'CANCELLED', finished_at = now() WHERE id = $1`, [gameId]);
    return game;
  });
}

export async function setLobbyMessageId(gameId, messageId) {
  await pool.query('UPDATE games SET lobby_message_id = $2 WHERE id = $1', [gameId, messageId]);
}

export async function setDmMessageId(gameId, telegramUserId, messageId) {
  await pool.query(
    `UPDATE game_players gp SET dm_message_id = $3
     FROM users u
     WHERE gp.game_id = $1 AND gp.user_id = u.id AND u.telegram_user_id = $2`,
    [gameId, telegramUserId, messageId],
  );
}

export async function getDmMessageId(gameId, telegramUserId) {
  const { rows } = await pool.query(
    `SELECT gp.dm_message_id
     FROM game_players gp
     JOIN users u ON u.id = gp.user_id
     WHERE gp.game_id = $1 AND u.telegram_user_id = $2`,
    [gameId, telegramUserId],
  );
  return rows[0]?.dm_message_id ?? null;
}
