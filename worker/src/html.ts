// Сборка HTML-сообщений для Telegram. Пользовательский текст всегда
// проходит через escapeHtml: & < > — единственные спецсимволы Telegram HTML.

import type { MessageRow } from './db';
import { ANONYMOUS_AUTHOR } from './config';
import { formatMsk } from './time';

export interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

const TELEGRAM_TEXT_LIMIT = 4096;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fitTelegramText(value: string): string {
  if (value.length <= TELEGRAM_TEXT_LIMIT) return value;
  // Защитный предел. При наших 1000 символах пользовательского текста сюда
  // попасть невозможно, но обрезаем аккуратно, чтобы Telegram не вернул 400.
  return `${value.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
}

export function buildPendingText(message: MessageRow): string {
  return [
    '🕒 <b>Ждёт проверки</b>',
    `<b>Имя:</b> ${escapeHtml(message.author)}`,
    `<b>Время:</b> ${escapeHtml(formatMsk(message.created_at))}`,
    `<b>ID:</b> ${message.id}`,
    '',
    escapeHtml(message.text),
  ].join('\n');
}

export function buildApprovedText(message: MessageRow): string {
  return [
    '✅ <b>Опубликовано</b>',
    `<b>Имя:</b> ${escapeHtml(message.author)}`,
    `<b>Время:</b> ${escapeHtml(formatMsk(message.created_at))}`,
    `<b>ID:</b> ${message.id}`,
    '',
    escapeHtml(message.text),
  ].join('\n');
}

export function buildDeletedText(): string {
  return '🗑 <b>Удалено</b>';
}

export function buildExpiredText(): string {
  return '⌛ <b>Удалено (истекло)</b>';
}

export function buildChannelPost(message: MessageRow): string {
  const author = message.author === ANONYMOUS_AUTHOR
    ? 'анон'
    : escapeHtml(message.author);
  return [
    `⋂⋂ — ${escapeHtml(message.text)}`,
    '',
    author,
    '<a href="https://князевдроп.рф">князевдроп.рф</a>',
  ].join('\n');
}

export function pendingKeyboard(messageId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Одобрить', callback_data: `ok:${messageId}` },
        { text: '🗑 Удалить', callback_data: `del:${messageId}` },
      ],
    ],
  };
}

export function approvedKeyboard(messageId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🗑 Удалить', callback_data: `del:${messageId}` }],
    ],
  };
}
