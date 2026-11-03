// Проверка токена Cloudflare Turnstile на сервере.

import {
  TURNSTILE_ACTION,
  TURNSTILE_VERIFY_URL,
  type Env,
} from './config';

interface TurnstileVerifyResponse {
  success: boolean;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  'error-codes'?: string[];
}

export type TurnstileResult = true | false | 'unavailable';

export async function verifyTurnstile(
  env: Env,
  token: string,
  remoteIp: string | null,
): Promise<TurnstileResult> {
  if (!env.TURNSTILE_SECRET) return 'unavailable';

  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return 'unavailable';

    const data = (await response.json()) as TurnstileVerifyResponse;
    if (!data.success) return false;

    // Токен выдан именно нашей формой, а не другим виджетом на том же сайте.
    // Значение "test" приходит от официальных тестовых ключей Cloudflare.
    if (data.action && data.action !== TURNSTILE_ACTION && data.action !== 'test') return false;

    return true;
  } catch {
    return 'unavailable';
  }
}
