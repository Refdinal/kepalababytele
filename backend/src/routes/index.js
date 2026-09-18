import { Router } from 'express';
import { pool } from '../db/pool.js';
import { isDatabaseConfigured, isBotConfigured } from '../config.js';
import { storageMode } from '../services/gameStore.js';

export const router = Router();

async function health(req, res) {
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
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    storage: storageMode,
    database,
    bot: isBotConfigured() ? 'configured' : 'not_configured',
    uptime: Math.round(process.uptime()),
  });
}

router.get('/', health);
router.get('/health', health);
