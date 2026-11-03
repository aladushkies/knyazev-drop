// Роутер Worker: /api/messages, /telegram и ежедневный cron.

import type { Env } from './config';
import {
  methodNotAllowed,
  notFound,
  preflightResponse,
} from './http';
import { handleGetMessages, handlePostMessage } from './messages';
import { cleanupExpired, handleTelegramWebhook } from './telegram';
import { errorResponse } from './http';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/api/messages') {
        if (request.method === 'OPTIONS') return preflightResponse(request, env);
        if (request.method === 'GET') return await handleGetMessages(request, env);
        if (request.method === 'POST') return await handlePostMessage(request, env, ctx);
        return methodNotAllowed('GET, POST, OPTIONS', request, env);
      }

      if (path === '/telegram') {
        if (request.method === 'POST') return await handleTelegramWebhook(request, env, ctx);
        return methodNotAllowed('POST', request, env);
      }

      return notFound(request, env);
    } catch (error) {
      console.error('wall: unhandled request error', error instanceof Error ? error.name : 'unknown');
      return errorResponse('server_error', 500, request, env);
    }
  },

  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(cleanupExpired(env));
  },
} satisfies ExportedHandler<Env>;
