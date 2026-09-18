import { GameError } from '../game/errors.js';
import {
  createRoom,
  loadGame,
  getActiveGameByChat,
  cancelRoom,
  setLobbyMessageId,
} from '../services/gameStore.js';
import { beginGame, sendTurnDm } from './gameplay.js';
import { renderLobby, renderGroupBoard, lobbyKeyboard } from './render.js';

function isGroupChat(ctx) {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}

async function replyError(ctx, error) {
  if (error instanceof GameError) {
    await ctx.reply(`❌ ${error.message}`);
    return;
  }
  throw error;
}

export async function refreshLobby(bot, gameId) {
  const { game, state } = await loadGame(gameId);
  if (game.status !== 'WAITING' || !game.lobby_message_id) return;
  try {
    await bot.api.editMessageText(game.chat_id, game.lobby_message_id, renderLobby(state), {
      parse_mode: 'HTML',
      reply_markup: lobbyKeyboard(gameId),
    });
  } catch {
    // ignore edit failures (message deleted, unchanged content, etc)
  }
}

export function registerLobbyHandlers(bot) {
  bot.command('newgame', async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply('Command ini hanya bisa dipakai di grup.');
      return;
    }
    try {
      const game = await createRoom({ chatId: ctx.chat.id, from: ctx.from });
      const { state } = await loadGame(game.id);
      const message = await ctx.reply(renderLobby(state), {
        parse_mode: 'HTML',
        reply_markup: lobbyKeyboard(game.id),
      });
      await setLobbyMessageId(game.id, message.message_id);
    } catch (error) {
      await replyError(ctx, error);
    }
  });

  bot.command('lobby', async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply('Command ini hanya bisa dipakai di grup.');
      return;
    }
    const game = await getActiveGameByChat(ctx.chat.id);
    if (!game) {
      await ctx.reply('Tidak ada game aktif. Kirim /newgame untuk membuat room.');
      return;
    }
    const { state } = await loadGame(game.id);
    if (game.status === 'WAITING') {
      const message = game.lobby_message_id
        ? { message_id: game.lobby_message_id }
        : await ctx.reply(renderLobby(state), { parse_mode: 'HTML', reply_markup: lobbyKeyboard(game.id) });
      if (!game.lobby_message_id) {
        await setLobbyMessageId(game.id, message.message_id);
      } else {
        try {
          await bot.api.editMessageText(ctx.chat.id, game.lobby_message_id, renderLobby(state), {
            parse_mode: 'HTML',
            reply_markup: lobbyKeyboard(game.id),
          });
        } catch {
          // ignore
        }
      }
      return;
    }
    await ctx.reply(renderGroupBoard(state), { parse_mode: 'HTML' });
    await sendTurnDm(bot, state);
  });

  bot.command('endgame', async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply('Command ini hanya bisa dipakai di grup.');
      return;
    }
    const game = await getActiveGameByChat(ctx.chat.id);
    if (!game) {
      await ctx.reply('Tidak ada game aktif.');
      return;
    }
    try {
      await cancelRoom(game.id, ctx.from);
      if (game.lobby_message_id) {
        try {
          await bot.api.editMessageText(game.chat_id, game.lobby_message_id, '❌ Room dibatalkan oleh host.', {
            reply_markup: undefined,
          });
        } catch {
          // ignore
        }
      } else {
        await ctx.reply('❌ Room dibatalkan.');
      }
    } catch (error) {
      await replyError(ctx, error);
    }
  });

  bot.callbackQuery(/^lobby:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await refreshLobby(bot, ctx.match[1]);
  });

  bot.callbackQuery(/^start:(.+)$/, async (ctx) => {
    try {
      await beginGame(bot, ctx.match[1], ctx.from);
      await ctx.answerCallbackQuery({ text: 'Game dimulai!' });
    } catch (error) {
      if (error instanceof GameError) {
        await ctx.answerCallbackQuery({ text: error.message, show_alert: true });
        return;
      }
      throw error;
    }
  });
}
