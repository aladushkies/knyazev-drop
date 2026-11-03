// Типизированные запросы к D1. Все значения передаются только через bind(),
// никакой конкатенации SQL с пользовательскими данными.

export interface MessageRow {
  id: number;
  author: string;
  text: string;
  created_at: number;
}

export interface NotificationRow {
  id: number;
  message_id: number;
  chat_id: string;
  tg_message_id: number;
  created_at: number;
}

const MESSAGE_COLUMNS = 'id, author, text, created_at';

export async function getApprovedMessages(
  db: D1Database,
  before: number | null,
  limit: number,
): Promise<MessageRow[]> {
  if (before === null) {
    const result = await db
      .prepare(
        `SELECT ${MESSAGE_COLUMNS}
         FROM messages
         WHERE status = 'approved'
         ORDER BY id DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<MessageRow>();
    return result.results ?? [];
  }

  const result = await db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS}
       FROM messages
       WHERE status = 'approved' AND id < ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .bind(before, limit)
    .all<MessageRow>();
  return result.results ?? [];
}

export async function insertPendingMessage(
  db: D1Database,
  author: string,
  text: string,
  now: number,
): Promise<MessageRow | null> {
  const result = await db
    .prepare(
      `INSERT INTO messages (author, text, status, created_at)
       VALUES (?, ?, 'pending', ?)
       RETURNING ${MESSAGE_COLUMNS}`,
    )
    .bind(author, text, now)
    .all<MessageRow>();
  return result.results?.[0] ?? null;
}

export async function approveMessage(
  db: D1Database,
  id: number,
): Promise<MessageRow | null> {
  const result = await db
    .prepare(
      `UPDATE messages
       SET status = 'approved'
       WHERE id = ? AND status = 'pending'
       RETURNING ${MESSAGE_COLUMNS}`,
    )
    .bind(id)
    .all<MessageRow>();
  return result.results?.[0] ?? null;
}

export async function deleteMessage(db: D1Database, id: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM messages WHERE id = ?')
    .bind(id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deletePendingMessage(db: D1Database, id: number): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM messages WHERE id = ? AND status = 'pending'")
    .bind(id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getMessageStatus(db: D1Database, id: number): Promise<string | null> {
  const row = await db
    .prepare('SELECT status FROM messages WHERE id = ?')
    .bind(id)
    .first<{ status: string }>();
  return row?.status ?? null;
}

export async function getNotifications(
  db: D1Database,
  messageId: number,
): Promise<NotificationRow[]> {
  const result = await db
    .prepare(
      `SELECT id, message_id, chat_id, tg_message_id, created_at
       FROM notifications
       WHERE message_id = ?
       ORDER BY id ASC`,
    )
    .bind(messageId)
    .all<NotificationRow>();
  return result.results ?? [];
}

export async function insertNotification(
  db: D1Database,
  messageId: number,
  chatId: string,
  tgMessageId: number,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO notifications
         (message_id, chat_id, tg_message_id, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(messageId, chatId, tgMessageId, now)
    .run();
}

export async function deleteNotification(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();
}

export async function deleteNotifications(
  db: D1Database,
  messageId: number,
): Promise<void> {
  await db.prepare('DELETE FROM notifications WHERE message_id = ?').bind(messageId).run();
}

export async function getExpiredPending(
  db: D1Database,
  cutoff: number,
  limit: number,
): Promise<MessageRow[]> {
  const result = await db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS}
       FROM messages
       WHERE status = 'pending' AND created_at < ?
       ORDER BY id ASC
       LIMIT ?`,
    )
    .bind(cutoff, limit)
    .all<MessageRow>();
  return result.results ?? [];
}

export async function deleteRateLimitsBefore(db: D1Database, cutoff: number): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(cutoff).run();
}

export async function deleteOrphanNotifications(db: D1Database): Promise<void> {
  await db
    .prepare('DELETE FROM notifications WHERE message_id NOT IN (SELECT id FROM messages)')
    .run();
}
