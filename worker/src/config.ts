// Общие константы и типы Worker. Значения лимитов собраны здесь,
// чтобы их можно было менять без переписывания логики.

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  TELEGRAM_CHANNEL_ID: string;
  TURNSTILE_SECRET: string;
  ADMIN_IDS: string;
  IP_HASH_SALT: string;
}

export const MAX_BODY_BYTES = 10 * 1024;
export const MAX_AUTHOR_CHARS = 50;
export const MAX_TEXT_CHARS = 1000;

export const PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 50;

export const SHORT_WINDOW_SECONDS = 20;
export const SHORT_WINDOW_LIMIT = 1;
export const LONG_WINDOW_SECONDS = 60 * 60;
export const LONG_WINDOW_LIMIT = 10;

export const PENDING_TTL_DAYS = 7;
export const RATE_LIMIT_RETENTION_SECONDS = 24 * 60 * 60;
export const MAX_PENDING_CLEANUP_PER_RUN = 5;

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_ACTION = 'wall_post';

export const TELEGRAM_API_BASE = 'https://api.telegram.org';
export const ANONYMOUS_AUTHOR = 'Аноним';
