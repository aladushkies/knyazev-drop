// Лимит частоты через D1.
//
// Почему D1, а не Workers Rate Limiting binding:
// - D1 входит в бесплатный план и уже используется проектом;
// - поведение одинаково локально и в production;
// - не зависит от доступности binding на текущем тарифе.
//
// Событие вставляется атомарным INSERT ... SELECT ... WHERE ... RETURNING:
// проверка лимита и запись происходят в одном SQLite-запросе, поэтому два
// одновременных запроса не могут оба проскочить.

import {
  LONG_WINDOW_LIMIT,
  LONG_WINDOW_SECONDS,
  SHORT_WINDOW_SECONDS,
} from './config';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

function normalizeIp(rawIp: string): string {
  let value = rawIp.trim().toLowerCase();
  if (!value) return 'unknown';

  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);

  // IPv4-mapped IPv6: ::ffff:192.0.2.1 -> 192.0.2.1
  if (value.startsWith('::ffff:') && value.includes('.')) {
    value = value.slice(7);
  }

  // Обычный IPv4.
  if (!value.includes(':')) return value;

  // IPv6: раскрываем :: и берём первые 4 hextet (префикс /64).
  // Это мешает обходить лимит перебором адресов внутри одной подсети.
  const [head = '', tail] = value.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail !== undefined ? tail.split(':') : [];
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [
    ...headGroups,
    ...Array.from({ length: missing }, () => '0'),
    ...tailGroups,
  ];
  return `${groups.slice(0, 4).map(group => group || '0').join(':')}::/64`;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashIp(rawIp: string, salt: string): Promise<string> {
  return hmacHex(salt, normalizeIp(rawIp));
}

export async function consumeRateLimit(
  db: D1Database,
  ipHash: string,
  now: number,
): Promise<RateLimitResult> {
  const shortStart = now - SHORT_WINDOW_SECONDS;
  const longStart = now - LONG_WINDOW_SECONDS;

  const inserted = await db
    .prepare(
      `INSERT INTO rate_limits (ip_hash, created_at)
       SELECT ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM rate_limits
         WHERE ip_hash = ? AND created_at > ?
       )
       AND (
         SELECT COUNT(*) FROM rate_limits
         WHERE ip_hash = ? AND created_at > ?
       ) < ?
       RETURNING id`,
    )
    .bind(ipHash, now, ipHash, shortStart, ipHash, longStart, LONG_WINDOW_LIMIT)
    .all<{ id: number }>();

  if (inserted.results && inserted.results.length > 0) {
    return { allowed: true, retryAfter: 0 };
  }

  const shortRow = await db
    .prepare(
      `SELECT MIN(created_at) AS oldest
       FROM rate_limits
       WHERE ip_hash = ? AND created_at > ?`,
    )
    .bind(ipHash, shortStart)
    .first<{ oldest: number | null }>();

  const longRow = await db
    .prepare(
      `SELECT COUNT(*) AS total, MIN(created_at) AS oldest
       FROM rate_limits
       WHERE ip_hash = ? AND created_at > ?`,
    )
    .bind(ipHash, longStart)
    .first<{ total: number; oldest: number | null }>();

  let retryAfter = 0;
  if (shortRow?.oldest !== null && shortRow?.oldest !== undefined) {
    retryAfter = Math.max(retryAfter, SHORT_WINDOW_SECONDS - (now - shortRow.oldest));
  }
  if ((longRow?.total ?? 0) >= LONG_WINDOW_LIMIT && longRow?.oldest !== null && longRow?.oldest !== undefined) {
    retryAfter = Math.max(retryAfter, LONG_WINDOW_SECONDS - (now - longRow.oldest));
  }

  return { allowed: false, retryAfter: Math.max(1, Math.ceil(retryAfter)) };
}
