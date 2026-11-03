// Эндпоинты стены: чтение одобренных сообщений и приём новых.

import {
  ANONYMOUS_AUTHOR,
  MAX_AUTHOR_CHARS,
  MAX_BODY_BYTES,
  MAX_PAGE_SIZE,
  MAX_TEXT_CHARS,
  PAGE_SIZE,
  type Env,
} from './config';
import { getApprovedMessages, insertPendingMessage } from './db';
import { errorResponse, jsonResponse, readBodyWithLimit } from './http';
import { consumeRateLimit, hashIp } from './rate-limit';
import { sendPendingToAdmins } from './telegram';
import { verifyTurnstile } from './turnstile';

function countCodePoints(value: string): number {
  return Array.from(value).length;
}

function stripControls(value: string, keepNewlines: boolean): string {
  let result = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    if (code === 10) {
      if (keepNewlines) result += '\n';
      continue;
    }

    // C0, DEL, C1.
    if (code < 32 || code === 127 || (code >= 128 && code <= 159)) continue;

    // Bidi-override символы: не ломают эмодзи, но могут визуально подменять текст.
    if ((code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) continue;

    // Нулевой ширины и BOM. ZWJ (U+200D) не трогаем — он нужен эмодзи.
    if (code === 0x200b || code === 0x200c || code === 0x200e || code === 0x200f || code === 0xfeff) continue;

    result += char;
  }
  return result;
}

function normalizeAuthor(value: string): string | null {
  const normalized = stripControls(value.replace(/\r\n?/g, ' '), false)
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length === 0) return ANONYMOUS_AUTHOR;
  if (countCodePoints(normalized) > MAX_AUTHOR_CHARS) return null;
  return normalized;
}

function normalizeText(value: string): string | null {
  const normalized = stripControls(value.replace(/\r\n?/g, '\n'), true)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized.length === 0) return null;
  if (countCodePoints(normalized) > MAX_TEXT_CHARS) return null;
  return normalized;
}

export async function handleGetMessages(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const limitParam = url.searchParams.get('limit');
  let limit = PAGE_SIZE;
  if (limitParam !== null) {
    if (!/^\d+$/.test(limitParam)) return errorResponse('invalid_limit', 400, request, env);
    limit = Number(limitParam);
    if (!Number.isSafeInteger(limit) || limit < 1) {
      return errorResponse('invalid_limit', 400, request, env);
    }
    if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
  }

  const beforeParam = url.searchParams.get('before');
  let before: number | null = null;
  if (beforeParam !== null) {
    if (!/^[1-9]\d{0,17}$/.test(beforeParam)) {
      return errorResponse('invalid_before', 400, request, env);
    }
    before = Number(beforeParam);
    if (!Number.isSafeInteger(before)) {
      return errorResponse('invalid_before', 400, request, env);
    }
  }

  const messages = await getApprovedMessages(env.DB, before, limit);
  return jsonResponse(messages, 200, request, env);
}

export async function handlePostMessage(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const contentType = (request.headers.get('Content-Type') ?? '')
    .toLowerCase()
    .split(';')[0]
    ?.trim();
  if (contentType !== 'application/json') {
    return errorResponse('unsupported_media_type', 415, request, env);
  }

  const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!body.ok) {
    if (body.reason === 'too_large') {
      return errorResponse('body_too_large', 413, request, env);
    }
    return errorResponse('bad_request', 400, request, env);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return errorResponse('bad_request', 400, request, env);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return errorResponse('bad_request', 400, request, env);
  }

  const data = payload as Record<string, unknown>;

  if (data.author !== undefined && data.author !== null && typeof data.author !== 'string') {
    return errorResponse('invalid_author', 400, request, env);
  }
  if (typeof data.text !== 'string') {
    return errorResponse('invalid_text', 400, request, env);
  }
  if (typeof data.turnstileToken !== 'string' || data.turnstileToken.trim().length === 0) {
    return errorResponse('turnstile_failed', 400, request, env);
  }

  const author = normalizeAuthor(typeof data.author === 'string' ? data.author : '');
  if (author === null) return errorResponse('invalid_author', 400, request, env);

  const text = normalizeText(data.text);
  if (text === null) return errorResponse('invalid_text', 400, request, env);

  if (!env.TURNSTILE_SECRET || !env.IP_HASH_SALT) {
    console.error('wall: TURNSTILE_SECRET or IP_HASH_SALT is not configured');
    return errorResponse('server_error', 500, request, env);
  }

  const remoteIp = request.headers.get('CF-Connecting-IP');
  const turnstile = await verifyTurnstile(env, data.turnstileToken.trim(), remoteIp);
  if (turnstile === 'unavailable') {
    return errorResponse('turnstile_unavailable', 503, request, env);
  }
  if (!turnstile) {
    return errorResponse('turnstile_failed', 400, request, env);
  }

  const now = Math.floor(Date.now() / 1000);
  const ipHash = await hashIp(remoteIp ?? 'unknown', env.IP_HASH_SALT);
  const rateLimit = await consumeRateLimit(env.DB, ipHash, now);

  if (!rateLimit.allowed) {
    return errorResponse(
      'rate_limited',
      429,
      request,
      env,
      { retry_after: rateLimit.retryAfter },
      { 'Retry-After': String(rateLimit.retryAfter) },
    );
  }

  const message = await insertPendingMessage(env.DB, author, text, now);
  if (!message) {
    return errorResponse('server_error', 500, request, env);
  }

  ctx.waitUntil(sendPendingToAdmins(env, message));

  return jsonResponse({ ok: true }, 201, request, env);
}
