-- Копии одобренных сообщений в Telegram-канале.
-- Нужны, чтобы при удалении со стены удалить и пост из канала.

CREATE TABLE IF NOT EXISTS channel_posts (
  message_id INTEGER PRIMARY KEY,
  chat_id TEXT NOT NULL,
  tg_message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
