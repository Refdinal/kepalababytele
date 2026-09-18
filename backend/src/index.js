import { createApp } from './app.js';
import { config } from './config.js';
import { createBot } from './bot/index.js';
import { createWebhookApp } from './bot/webhook.js';

const isServerless = Boolean(process.env.VERCEL);
const botMode = process.env.BOT_MODE ?? (isServerless ? 'webhook' : 'polling');
const useWebhook = botMode === 'webhook';

const app = createApp({
  mount: useWebhook ? (expressApp) => expressApp.use('/api/bot', createWebhookApp()) : undefined,
});

export default app;

if (!isServerless) {
  app.listen(config.port, () => {
    console.log(`Kepala Babi API berjalan di http://localhost:${config.port} (${config.nodeEnv})`);
  });

  if (useWebhook) {
    console.log('Mode webhook aktif di /api/bot (butuh PUBLIC_URL dan HTTPS untuk Telegram).');
  } else {
    const bot = createBot();
    if (bot) {
      bot
        .start({
          onStart: (info) => console.log(`Bot @${info.username} berjalan (long polling).`),
        })
        .catch((error) => {
          console.error('Bot gagal berjalan:', error.message);
        });
    } else {
      console.log('TELEGRAM_BOT_TOKEN belum diisi, bot tidak dijalankan.');
    }
  }
}
