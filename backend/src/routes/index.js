import { Router } from 'express';
import { pool } from '../db/pool.js';
import { isDatabaseConfigured, isBotConfigured } from '../config.js';
import { storageMode } from '../services/gameStore.js';

export const router = Router();

router.get('/health', async (req, res) => {
  let database = 'not_configured';
  if (isDatabaseConfigured()) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'error';
    }
  }
  res.json({
    success: true,
    status: 'ok',
    storage: storageMode,
    database,
    bot: isBotConfigured() ? 'configured' : 'not_configured',
    uptime: Math.round(process.uptime()),
  });
});
