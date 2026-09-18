export const ERROR_CODES = {
  GAME_NOT_FOUND: 'Game tidak ditemukan.',
  GAME_ALREADY_STARTED: 'Game sudah dimulai.',
  GAME_ALREADY_ACTIVE: 'Masih ada game aktif di chat ini.',
  GAME_NOT_PLAYING: 'Game tidak sedang berlangsung.',
  GAME_FINISHED: 'Game sudah selesai.',
  GAME_NOT_WAITING: 'Game tidak dalam status menunggu.',
  NOT_ENOUGH_PLAYERS: 'Minimal 2 pemain untuk memulai game.',
  PLAYER_NOT_IN_GAME: 'Pemain tidak ada di game ini.',
  PLAYER_ALREADY_JOINED: 'Pemain sudah bergabung.',
  JOIN_CLOSED: 'Tidak bisa join setelah game dimulai.',
  NOT_HOST: 'Hanya host yang dapat melakukan aksi ini.',
  NOT_YOUR_TURN: 'Bukan giliran Anda.',
  INVALID_TARGET: 'Target tidak valid.',
  TARGET_NOT_ACTIVE: 'Target tidak aktif.',
  INVALID_CARD_INDEX: 'Index kartu tidak valid.',
  UNAUTHORIZED: 'Tidak diizinkan.',
  DEADLOCK: 'Game tidak selesai setelah batas turn.',
};

export class GameError extends Error {
  constructor(code) {
    super(ERROR_CODES[code] ?? code);
    this.name = 'GameError';
    this.code = code;
  }
}
