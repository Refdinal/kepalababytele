import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  publicUrl: process.env.PUBLIC_URL ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
};

export function isDatabaseConfigured() {
  return config.databaseUrl.length > 0;
}

export function isBotConfigured() {
  return config.botToken.length > 0;
}
