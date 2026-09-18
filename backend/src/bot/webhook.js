import express from 'express';
import { webhookCallback } from 'grammy';
import { config } from '../config.js';
import { createBot } from './index.js';

let registrationPromise = null;

function resolveWebhookUrl(req) {
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/+$/, '')}/api/bot`;
  }
  if (process.env.VERCEL_ENV === 'production') {
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;
    if (host) return `https://${host}/api/bot`;
  }
  return null;
}

async function ensureWebhookRegistered(bot, req) {
  const url = resolveWebhookUrl(req);
  if (!url) return;
  if (!registrationPromise) {
    registrationPromise = bot.api
      .setWebhook(url, config.webhookSecret ? { secret_token: config.webhookSecret } : {})
      .then(() => console.log(`Webhook terdaftar: ${url}`))
      .catch((error) => {
        registrationPromise = null;
        console.error('Gagal registrasi webhook:', error.message);
      });
  }
  await registrationPromise;
}

export function createWebhookApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const bot = createBot();
  if (!bot) {
    app.use((req, res) => {
      res.status(503).json({
        success: false,
        error: { code: 'BOT_NOT_CONFIGURED', message: 'TELEGRAM_BOT_TOKEN belum diisi.' },
      });
    });
    return app;
  }

  app.use(async (req, res, next) => {
    try {
      await ensureWebhookRegistered(bot, req);
    } catch {
      // registrasi webhook tidak boleh menggagalkan update
    }
    next();
  });

  app.use(
    webhookCallback(bot, 'express', config.webhookSecret ? { secretToken: config.webhookSecret } : {}),
  );
  return app;
}
