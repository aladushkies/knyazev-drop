-- Князев Wall: сообщения, копии уведомлений в Telegram и лимиты частоты.

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL CHECK (length(author) BETWEEN 1 AND 50),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_status_id
  ON messages (status, id DESC);

-- Копии сообщения у каждого админа. Без ON DELETE CASCADE:
-- строки нужны, чтобы отредактировать копии после физического удаления сообщения.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  chat_id TEXT NOT NULL,
  tg_message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (message_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_message_id
  ON notifications (message_id);

-- События успешных отправок. Сам IP не хранится — только HMAC-хэш.
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_time
  ON rate_limits (ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_time
  ON rate_limits (created_at);
