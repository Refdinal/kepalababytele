import { GameError } from '../game/errors.js';
import { getTurnInfo } from '../game/gameEngine.js';
import { config } from '../config.js';
import {
  startGameById,
  drawCardByTelegramId,
  getGameById,
  setLobbyMessageId,
  setDmMessageId,
  getDmMessageId,
} from '../services/gameStore.js';
import {
  renderHandDm,
  renderGroupBoard,
  renderTurnDm,
  renderTurnKeyboard,
  renderDrawResultDm,
  renderGameOver,
  describeEvents,
  renderMention,
  botUsername,
} from './render.js';

async function updateGroupBoard(bot, state, lobbyMessageId, eventLines = []) {
  const text = renderGroupBoard(state, eventLines);
  if (lobbyMessageId) {
    try {
      await bot.api.editMessageText(state.chatId, lobbyMessageId, text, { parse_mode: 'HTML' });
      return;
    } catch {
      // fall through to send a new message
    }
  }
  const message = await bot.api.sendMessage(state.chatId, text, { parse_mode: 'HTML' });
  await setLobbyMessageId(state.gameId, message.message_id);
}

async function notifyDmProblem(bot, state, player) {
  if (!state.chatId) return;
  const link = botUsername() ? ` Buka dulu: https://t.me/${botUsername()}?start=join_${state.gameId}` : '';
  try {
    await bot.api.sendMessage(
      state.chatId,
      `⚠️ ${renderMention(player)} belum membuka chat pribadi bot.${link}`,
      { parse_mode: 'HTML' },
    );
  } catch {
    // ignore group notify failures
  }
}

export async function sendTurnDm(bot, state) {
  const { currentPlayer, targetPlayer } = getTurnInfo(state);
  if (!currentPlayer || !targetPlayer) return;
  const text = renderTurnDm(state);
  const keyboard = renderTurnKeyboard(state.gameId, targetPlayer.hand.length);
  const existingId = await getDmMessageId(state.gameId, currentPlayer.telegramUserId);
  try {
    if (existingId) {
      await bot.api.editMessageText(currentPlayer.telegramUserId, existingId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      const message = await bot.api.sendMessage(currentPlayer.telegramUserId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await setDmMessageId(state.gameId, currentPlayer.telegramUserId, message.message_id);
    }
  } catch {
    await notifyDmProblem(bot, state, currentPlayer);
  }
}

export async function beginGame(bot, gameId, from) {
  const { state, game } = await startGameById(gameId, from);

  for (const player of state.players) {
    try {
      const message = await bot.api.sendMessage(player.telegramUserId, renderHandDm(player), {
        parse_mode: 'HTML',
      });
      await setDmMessageId(gameId, player.telegramUserId, message.message_id);
    } catch {
      await notifyDmProblem(bot, state, player);
    }
  }

  await updateGroupBoard(bot, state, game.lobby_message_id);
  if (state.status === 'PLAYING') {
    await sendTurnDm(bot, state);
  }
  return state;
}

export async function handleDraw(bot, ctx, gameId, cardIndex) {
  let payload;
  try {
    payload = await drawCardByTelegramId(gameId, ctx.from, cardIndex);
  } catch (error) {
    if (error instanceof GameError) {
      await ctx.answerCallbackQuery({ text: error.message, show_alert: true });
      return;
    }
    throw error;
  }

  const { state, result } = payload;
  await ctx.answerCallbackQuery({ text: 'OK' });

  const drawerId = String(ctx.from.id);
  try {
    await ctx.editMessageText(renderDrawResultDm(state, drawerId, result), { parse_mode: 'HTML' });
  } catch {
    // ignore edit failures on old messages
  }

  const game = await getGameById(gameId);
  const eventLines = describeEvents(state, result.events);
  await updateGroupBoard(bot, state, game.lobby_message_id, eventLines);

  if (state.status === 'FINISHED') {
    await bot.api.sendMessage(state.chatId, renderGameOver(state), { parse_mode: 'HTML' });
    return;
  }
  await sendTurnDm(bot, state);
}
