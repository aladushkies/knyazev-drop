// Telegram-бот: рассылка новых сообщений админам, обработка callback_query,
// синхронизация копий после одобрения/удаления и ежедневная уборка.

import {
  MAX_BODY_BYTES,
  MAX_PENDING_CLEANUP_PER_RUN,
  PENDING_TTL_DAYS,
  RATE_LIMIT_RETENTION_SECONDS,
  TELEGRAM_API_BASE,
  type Env,
} from './config';
import { readBodyWithLimit } from './http';
import {
  buildApprovedText,
  buildDeletedText,
  buildExpiredText,
  buildPendingText,
  approvedKeyboard,
  fitTelegramText,
  pendingKeyboard,
  type InlineKeyboardMarkup,
} from './html';
import {
  approveMessage,
  deleteMessage,
  deleteNotification,
  deleteNotifications,
  deleteOrphanNotifications,
  deletePendingMessage,
  deleteRateLimitsBefore,
  getExpiredPending,
  getMessageStatus,
  getNotifications,
  insertNotification,
  type MessageRow,
  type NotificationRow,
} from './db';

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
}

interface TelegramCallbackQuery {
  id: string;
  from?: { id?: number; is_bot?: boolean };
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id?: number;
  callback_query?: TelegramCallbackQuery;
}

type EditResult = 'ok' | 'not_modified' | 'not_found' | 'failed';
type CallbackAction = 'ok' | 'del';

function getAdminIds(env: Env): string[] {
  const raw = env.ADMIN_IDS ?? '';
  const ids = raw
    .split(/[,\s]+/)
    .map(value => value.trim())
    .filter(value => /^\d+$/.test(value));
  return [...new Set(ids)];
}

function isAdmin(env: Env, userId: number | undefined): boolean {
  if (userId === undefined || !Number.isFinite(userId)) return false;
  return getAdminIds(env).includes(String(userId));
}

function parseCallbackData(data: string): { action: CallbackAction; id: number } | null {
  const match = /^(ok|del):([1-9]\d{0,17})$/.exec(data);
  if (!match) return null;

  const action = match[1];
  const rawId = match[2];
  if ((action !== 'ok' && action !== 'del') || !rawId) return null;

  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { action, id };
}

async function callTelegram<T>(
  env: Env,
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; result?: T } | { ok: false; description: string }> {
  const url = `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;

    if (!response.ok || !data?.ok) {
      console.warn(
        `telegram ${method} failed`,
        response.status,
        data?.error_code ?? 'no_code',
        data?.description ?? 'no_description',
      );
      return { ok: false, description: data?.description ?? `HTTP ${response.status}` };
    }
    return { ok: true, result: data.result };
  } catch (error) {
    console.warn(`telegram ${method} request failed`, error instanceof Error ? error.name : 'unknown');
    return { ok: false, description: 'network_error' };
  }
}

async function answerCallbackQuery(
  env: Env,
  callbackQueryId: string,
  text: string,
): Promise<void> {
  await callTelegram(env, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

async function sendMessage(
  env: Env,
  chatId: string,
  text: string,
  keyboard: InlineKeyboardMarkup,
): Promise<number | null> {
  const result = await callTelegram<TelegramMessage>(env, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard,
  });
  if (!result.ok || !result.result) return null;
  return result.result.message_id;
}

async function editMessageText(
  env: Env,
  chatId: string,
  messageId: number,
  text: string,
  keyboard: InlineKeyboardMarkup | null,
): Promise<EditResult> {
  const result = await callTelegram<unknown>(env, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard ?? { inline_keyboard: [] },
  });

  if (result.ok) return 'ok';

  const description = (result.description ?? '').toLowerCase();
  if (description.includes('message is not modified')) return 'not_modified';
  if (description.includes('message to edit not found')) return 'not_found';
  return 'failed';
}

async function syncApproved(
  env: Env,
  message: MessageRow,
  notifications: NotificationRow[],
): Promise<void> {
  // Если параллельно сообщение уже удалили, не воскрешаем кнопки «Удалить»
  // в копиях админов. Полная сериализация действий потребовала бы Durable Object.
  const currentStatus = await getMessageStatus(env.DB, message.id);
  if (currentStatus !== 'approved') return;

  const text = fitTelegramText(buildApprovedText(message));
  const keyboard = approvedKeyboard(message.id);

  const results = await Promise.allSettled(
    notifications.map(async notification => {
      const result = await editMessageText(
        env,
        notification.chat_id,
        notification.tg_message_id,
        text,
        keyboard,
      );
      if (result === 'not_found') {
        await deleteNotification(env.DB, notification.id);
      }
      return result;
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('wall: failed to update an approved notification', message.id);
    }
  }
}

async function syncDeleted(
  env: Env,
  messageId: number,
  notifications: NotificationRow[],
): Promise<void> {
  const text = buildDeletedText();

  const results = await Promise.allSettled(
    notifications.map(notification =>
      editMessageText(env, notification.chat_id, notification.tg_message_id, text, null),
    ),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('wall: failed to update a deleted notification', messageId);
    }
  }

  // Строки нужны были только для правки копий. После попытки правки удаляем их.
  await deleteNotifications(env.DB, messageId);
}

async function approveAndSync(env: Env, messageId: number, callbackId: string): Promise<void> {
  try {
    const notifications = await getNotifications(env.DB, messageId);
    const message = await approveMessage(env.DB, messageId);

    if (message) {
      await answerCallbackQuery(env, callbackId, 'Опубликовано');
      await syncApproved(env, message, notifications);
      return;
    }

    const status = await getMessageStatus(env.DB, messageId);
    if (!status) {
      await answerCallbackQuery(env, callbackId, 'Уже удалено');
    } else if (status === 'approved') {
      await answerCallbackQuery(env, callbackId, 'Уже опубликовано');
    } else {
      await answerCallbackQuery(env, callbackId, 'Не удалось обновить');
    }
  } catch (error) {
    console.error('wall: approve failed', error instanceof Error ? error.name : 'unknown');
    await answerCallbackQuery(env, callbackId, 'Ошибка, попробуйте ещё раз');
  }
}

async function deleteAndSync(env: Env, messageId: number, callbackId: string): Promise<void> {
  try {
    const notifications = await getNotifications(env.DB, messageId);
    const changed = await deleteMessage(env.DB, messageId);

    await answerCallbackQuery(env, callbackId, changed ? 'Удалено' : 'Уже удалено');
    await syncDeleted(env, messageId, notifications);
  } catch (error) {
    console.error('wall: delete failed', error instanceof Error ? error.name : 'unknown');
    await answerCallbackQuery(env, callbackId, 'Ошибка, попробуйте ещё раз');
  }
}

export async function sendPendingToAdmins(env: Env, message: MessageRow): Promise<void> {
  const admins = getAdminIds(env);
  if (admins.length === 0) {
    console.error('wall: ADMIN_IDS is empty, notification not sent', message.id);
    return;
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error('wall: TELEGRAM_BOT_TOKEN is empty, notification not sent', message.id);
    return;
  }

  const text = fitTelegramText(buildPendingText(message));
  const keyboard = pendingKeyboard(message.id);
  const now = Math.floor(Date.now() / 1000);

  const results = await Promise.allSettled(
    admins.map(async chatId => {
      const tgMessageId = await sendMessage(env, chatId, text, keyboard);
      if (tgMessageId === null) return;

      try {
        await insertNotification(env.DB, message.id, chatId, tgMessageId, now);
      } catch (error) {
        console.error(
          'wall: notification row insert failed',
          message.id,
          error instanceof Error ? error.name : 'unknown',
        );
      }
    }),
  );

  const failed = results.filter(result => result.status === 'rejected').length;
  if (failed > 0) {
    console.warn('wall: some admin notifications were not sent', message.id, failed);
  }
}

export async function handleTelegramWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!body.ok) {
    if (body.reason === 'too_large') {
      return new Response('Payload Too Large', { status: 413 });
    }
    return new Response('ok', { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = JSON.parse(body.text) as TelegramUpdate;
  } catch {
    return new Response('ok', { status: 200 });
  }

  const callback = update.callback_query;
  if (!callback) return new Response('ok', { status: 200 });
  if (!callback.id) return new Response('ok', { status: 200 });

  if (!isAdmin(env, callback.from?.id)) {
    ctx.waitUntil(answerCallbackQuery(env, callback.id, 'Нет доступа'));
    return new Response('ok', { status: 200 });
  }

  const parsed = parseCallbackData(callback.data ?? '');
  if (!parsed) {
    ctx.waitUntil(answerCallbackQuery(env, callback.id, 'Неизвестное действие'));
    return new Response('ok', { status: 200 });
  }

  if (parsed.action === 'ok') {
    ctx.waitUntil(approveAndSync(env, parsed.id, callback.id));
  } else {
    ctx.waitUntil(deleteAndSync(env, parsed.id, callback.id));
  }

  return new Response('ok', { status: 200 });
}

export async function cleanupExpired(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - PENDING_TTL_DAYS * 24 * 60 * 60;

  try {
    const expired = await getExpiredPending(env.DB, cutoff, MAX_PENDING_CLEANUP_PER_RUN);

    for (const message of expired) {
      const notifications = await getNotifications(env.DB, message.id);
      const text = buildExpiredText();

      // Удаляем только если сообщение всё ещё pending: его могли одобрить
      // или удалить, пока cron добирался до этой строки.
      const deleted = await deletePendingMessage(env.DB, message.id);
      if (!deleted) continue;

      await Promise.allSettled(
        notifications.map(notification =>
          editMessageText(env, notification.chat_id, notification.tg_message_id, text, null),
        ),
      );

      await deleteNotifications(env.DB, message.id);
    }

    await deleteRateLimitsBefore(env.DB, now - RATE_LIMIT_RETENTION_SECONDS);
    await deleteOrphanNotifications(env.DB);

    console.log('wall cleanup finished', { expired: expired.length });
  } catch (error) {
    console.error('wall: cleanup failed', error instanceof Error ? error.name : 'unknown');
  }
}
