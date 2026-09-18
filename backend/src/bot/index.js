import { Bot } from 'grammy';
import { config, isBotConfigured } from '../config.js';
import { GameError } from '../game/errors.js';
import { upsertUser, joinRoom, loadGame } from '../services/gameStore.js';
import { registerLobbyHandlers } from './lobby.js';
import { handleDraw } from './gameplay.js';
import { renderWelcome, renderHelp, renderLobby, lobbyKeyboard } from './render.js';

async function handleJoinPayload(bot, ctx, gameId) {
  try {
    const game = await joinRoom(gameId, ctx.from);
    await ctx.reply('✅ Berhasil join! Kartu kamu akan dikirim ke chat ini saat host memulai game.');
    if (game.lobby_message_id && game.chat_id) {
      const { state } = await loadGame(game.id);
      try {
        await bot.api.editMessageText(game.chat_id, game.lobby_message_id, renderLobby(state), {
          parse_mode: 'HTML',
          reply_markup: lobbyKeyboard(game.id),
        });
      } catch {
        // ignore edit failures
      }
    }
  } catch (error) {
    if (error instanceof GameError) {
      await ctx.reply(`❌ ${error.message}`);
      return;
    }
    throw error;
  }
}

export function createBot() {
  if (!isBotConfigured()) return null;

  const bot = new Bot(config.botToken);
  bot.catch((error) => {
    console.error('Bot error:', error.error ?? error);
  });

  registerLobbyHandlers(bot);

  bot.command('start', async (ctx) => {
    const payload = (ctx.match ?? '').trim();
    if (payload.startsWith('join_')) {
      await handleJoinPayload(bot, ctx, payload.slice(5));
      return;
    }
    await upsertUser(ctx.from);
    await ctx.reply(renderWelcome(), { parse_mode: 'HTML' });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(renderHelp(), { parse_mode: 'HTML' });
  });

  bot.callbackQuery(/^draw:([0-9a-fA-F-]{36}):(\d+)$/, async (ctx) => {
    await handleDraw(bot, ctx, ctx.match[1], Number(ctx.match[2]));
  });

  bot.api.setMyCommands([
    { command: 'newgame', description: 'Buat room baru di grup' },
    { command: 'lobby', description: 'Lihat lobby atau game aktif' },
    { command: 'endgame', description: 'Host membatalkan room' },
    { command: 'help', description: 'Aturan dan cara main' },
  ]).catch(() => {});

  return bot;
}
