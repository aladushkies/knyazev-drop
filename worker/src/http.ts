// HTTP-помощники: CORS, JSON-ответы, ошибки и чтение тела с жёстким лимитом.

import type { Env } from './config';

const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type';

function allowedOrigin(env: Env): string {
  return (env.ALLOWED_ORIGIN ?? '').trim().replace(/\/+$/, '');
}

export function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  headers.set('Vary', 'Origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  headers.set('Access-Control-Expose-Headers', 'Retry-After');

  const origin = request.headers.get('Origin');
  const allowed = allowedOrigin(env);
  if (origin && allowed && origin === allowed) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

export function preflightResponse(request: Request, env: Env): Response {
  const headers = corsHeaders(request, env);
  headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Expose-Headers', 'Retry-After');
  return new Response(null, { status: 204, headers });
}

export function jsonResponse(
  data: unknown,
  status: number,
  request: Request,
  env: Env,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers.set(name, value);
    }
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(
  code: string,
  status: number,
  request: Request,
  env: Env,
  extra?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse(
    { ok: false, error: code, ...(extra ?? {}) },
    status,
    request,
    env,
    extraHeaders,
  );
}

export function notFound(request: Request, env: Env): Response {
  return errorResponse('not_found', 404, request, env);
}

export function methodNotAllowed(allow: string, request: Request, env: Env): Response {
  return errorResponse('method_not_allowed', 405, request, env, undefined, { Allow: allow });
}

export type LimitedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too_large' | 'invalid' };

export async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<LimitedBodyResult> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isFinite(declared) || declared < 0) return { ok: false, reason: 'invalid' };
    if (declared > maxBytes) return { ok: false, reason: 'too_large' };
  }

  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!chunk.value) continue;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, text: new TextDecoder().decode(bytes) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
