import { isDatabaseConfigured } from '../config.js';
import * as memoryStore from './memoryStore.js';
import * as postgresStore from './gameService.js';

const impl = isDatabaseConfigured() ? postgresStore : memoryStore;

export const storageMode = isDatabaseConfigured() ? 'postgres' : 'memory';

if (storageMode === 'memory' && process.env.VERCEL) {
  console.warn(
    'PERINGATAN: berjalan di Vercel tanpa DATABASE_URL. State in-memory tidak bertahan antar request. Isi DATABASE_URL (Neon) pada Environment Variables.',
  );
}

export const upsertUser = (...args) => impl.upsertUser(...args);
export const createRoom = (...args) => impl.createRoom(...args);
export const joinRoom = (...args) => impl.joinRoom(...args);
export const loadGame = (...args) => impl.loadGame(...args);
export const getActiveGameByChat = (...args) => impl.getActiveGameByChat(...args);
export const getGameById = (...args) => impl.getGameById(...args);
export const startGameById = (...args) => impl.startGameById(...args);
export const drawCardByTelegramId = (...args) => impl.drawCardByTelegramId(...args);
export const cancelRoom = (...args) => impl.cancelRoom(...args);
export const setLobbyMessageId = (...args) => impl.setLobbyMessageId(...args);
export const setDmMessageId = (...args) => impl.setDmMessageId(...args);
export const getDmMessageId = (...args) => impl.getDmMessageId(...args);
