import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { formatCard } from '../game/cards.js';
import { getTurnInfo } from '../game/gameEngine.js';

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function findPlayer(state, playerId) {
  return state.players.find((player) => player.playerId === playerId) ?? null;
}

export function renderName(player) {
  return escapeHtml(player.displayName);
}

export function renderMention(player) {
  if (player.username) return `@${escapeHtml(player.username)}`;
  return `<a href="tg://user?id=${player.telegramUserId}">${renderName(player)}</a>`;
}

export function renderHand(hand) {
  return hand.map((card) => formatCard(card)).join(' ');
}

export function botUsername() {
  return config.botUsername.replace(/^@/, '');
}

export function lobbyKeyboard(gameId) {
  const keyboard = new InlineKeyboard();
  if (botUsername()) {
    keyboard.url('➕ Join', `https://t.me/${botUsername()}?start=join_${gameId}`);
  }
  keyboard.text('▶️ Mulai', `start:${gameId}`).row();
  keyboard.text('🔄 Refresh', `lobby:${gameId}`);
  return keyboard;
}

export function renderTurnKeyboard(gameId, cardCount) {
  const keyboard = new InlineKeyboard();
  for (let index = 0; index < cardCount; index += 1) {
    if (index > 0 && index % 8 === 0) keyboard.row();
    keyboard.text('?', `draw:${gameId}:${index}`);
  }
  return keyboard;
}

export function renderLobby(state) {
  const lines = ['🐷 <b>KEPALA BABI</b>', '', `Pemain (${state.players.length}):`];
  state.players.forEach((player, index) => {
    lines.push(`${index + 1}. ${renderName(player)}`);
  });
  const host = findPlayer(state, state.hostPlayerId);
  lines.push('', `Host: ${host ? renderName(host) : '-'}`);
  lines.push('Tekan <b>Join</b> untuk ikut. Host tekan <b>Mulai</b>.');
  return lines.join('\n');
}

export function renderGroupBoard(state, eventLines = []) {
  const lines = ['🐷 <b>KEPALA BABI</b>'];
  if (eventLines.length > 0) {
    lines.push('', ...eventLines.slice(-4));
  }
  lines.push('', `Pemain (${state.players.length}):`);
  state.players.forEach((player, index) => {
    const turn = player.playerId === state.currentPlayerId ? ' ⬅️ giliran' : '';
    const out = player.status === 'OUT' ? ' ✅ selesai' : '';
    lines.push(`${index + 1}. ${renderName(player)} — ${player.hand.length} kartu${turn}${out}`);
  });
  const current = findPlayer(state, state.currentPlayerId);
  if (current) lines.push('', `Giliran: ${renderMention(current)}`);
  return lines.join('\n');
}

export function renderHandDm(player) {
  return [
    '🃏 <b>Game dimulai!</b>',
    '',
    `Kartu kamu (${player.hand.length}): ${renderHand(player.hand)}`,
    '',
    'Kartu akan diminta satu per satu saat giliranmu.',
  ].join('\n');
}

export function renderTurnDm(state) {
  const { currentPlayer, targetPlayer } = getTurnInfo(state);
  if (!currentPlayer || !targetPlayer) return null;
  return [
    '🎮 <b>Giliran kamu!</b>',
    '',
    `Ambil 1 kartu dari <b>${renderName(targetPlayer)}</b> (${targetPlayer.hand.length} kartu).`,
    '',
    'Pilih salah satu kartu tertutup di bawah.',
    '',
    `Kartu kamu (${currentPlayer.hand.length}): ${renderHand(currentPlayer.hand)}`,
  ].join('\n');
}

export function renderDrawResultDm(state, playerId, result) {
  const player = findPlayer(state, playerId);
  const lines = [`✅ Kamu mengambil: <b>${formatCard(result.card)}</b>`];
  for (const pair of result.pairs) {
    lines.push(`Pasangan dibuang: ${pair.map((card) => formatCard(card)).join(' + ')}`);
  }
  if (state.status === 'FINISHED') {
    if (state.pigHeadPlayerId === playerId) {
      lines.push('', '🐷 Kamu menjadi <b>KEPALA BABI</b>!');
    } else {
      const pig = findPlayer(state, state.pigHeadPlayerId);
      lines.push('', `Game selesai. Kepala Babi: <b>${pig ? renderName(pig) : '-'}</b>`);
    }
    return lines.join('\n');
  }
  if (player && player.status === 'OUT') {
    lines.push('', '🎉 Kamu selesai! Kartu kamu habis.');
    return lines.join('\n');
  }
  lines.push('', `Kartu kamu (${player.hand.length}): ${renderHand(player.hand)}`);
  return lines.join('\n');
}

export function describeEvents(state, events) {
  const lines = [];
  for (const event of events) {
    const player = findPlayer(state, event.playerId);
    const name = player ? renderName(player) : 'Pemain';
    if (event.type === 'CARD_DRAWN') {
      const target = findPlayer(state, event.targetPlayerId);
      lines.push(`${name} mengambil 1 kartu dari ${target ? renderName(target) : 'pemain'}.`);
    } else if (event.type === 'PAIR_DISCARDED') {
      lines.push(`${name} membuang ${event.pairCount} pasangan.`);
    } else if (event.type === 'PLAYER_OUT') {
      lines.push(`${name} selesai! 🎉`);
    }
  }
  return lines;
}

export function formatDuration(state) {
  if (!state.startedAt || !state.finishedAt) return '-';
  const seconds = Math.max(0, Math.round((new Date(state.finishedAt) - new Date(state.startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function renderGameOver(state) {
  const pig = findPlayer(state, state.pigHeadPlayerId);
  return [
    '🐷 <b>KEPALA BABI</b>',
    '',
    pig ? renderMention(pig) : '-',
    '',
    `${state.players.length} pemain`,
    `Durasi: ${formatDuration(state)}`,
  ].join('\n');
}

export function renderWelcome() {
  return [
    '🐷 <b>Kepala Babi</b> — permainan kartu Telegram.',
    '',
    'Cara main:',
    '1. Tambahkan bot ke grup.',
    '2. Kirim /newgame di grup.',
    '3. Pemain lain menekan tombol Join (wajib buka chat bot dulu).',
    '4. Host menekan Mulai.',
    '5. Kartu dibagikan lewat chat pribadi bot.',
    '6. Saat giliranmu, pilih kartu tertutup dari pemain berikutnya.',
    '7. Pemain terakhir yang masih memegang Joker menjadi Kepala Babi.',
    '',
    'Kirim /help untuk aturan lengkap.',
  ].join('\n');
}

export function renderHelp() {
  return [
    '<b>Aturan Kepala Babi</b>',
    '',
    '• 53 kartu: 52 kartu remi + 1 Joker.',
    '• Dua kartu jadi pasangan bila rank dan warnanya sama (♥♦ merah, ♠♣ hitam).',
    '• Pasangan otomatis dibuang setelah dibagikan dan setelah mengambil kartu.',
    '• Giliranmu: ambil 1 kartu tertutup dari pemain aktif berikutnya.',
    '• Pemain tanpa kartu selesai dan dilewati.',
    '• Joker tidak bisa dibuang. Pemain terakhir yang memegangnya jadi Kepala Babi.',
    '',
    'Command:',
    '/newgame — buat room di grup',
    '/lobby — lihat lobby/game aktif',
    '/endgame — host membatalkan room',
    '/help — bantuan ini',
  ].join('\n');
}
