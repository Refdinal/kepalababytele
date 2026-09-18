import { GameError } from '../game/errors.js';

const STATUS_BY_CODE = {
  GAME_NOT_FOUND: 404,
  UNAUTHORIZED: 403,
  NOT_HOST: 403,
  NOT_YOUR_TURN: 409,
  GAME_ALREADY_STARTED: 409,
  GAME_NOT_PLAYING: 409,
  GAME_NOT_WAITING: 409,
  GAME_FINISHED: 409,
  JOIN_CLOSED: 409,
  PLAYER_ALREADY_JOINED: 409,
  NOT_ENOUGH_PLAYERS: 400,
  PLAYER_NOT_IN_GAME: 400,
  INVALID_TARGET: 400,
  TARGET_NOT_ACTIVE: 400,
  INVALID_CARD_INDEX: 400,
  DEADLOCK: 500,
};

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' },
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof GameError) {
    res.status(STATUS_BY_CODE[error.code] ?? 400).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
    return;
  }
  console.error(error);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' },
  });
}
