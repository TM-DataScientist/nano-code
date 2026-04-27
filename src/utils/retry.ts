import { LLMApiError } from '../types';

const MAX_BACKOFF_MS = 60000;

// LLM APIの一時的なエラーに対する指数バックオフ再試行ヘルパー
// `<T>` はジェネリクスです。fn が string を返すなら Promise<string>、
// オブジェクトを返すならそのオブジェクト型、というように戻り値の型を保ったまま再試行できます。
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: LLMApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 成功したら即 return します。以後の retry は実行されません。
      return await fn();
    } catch (error) {
      // LLMApiError 以外は「一時的なAPIエラー」と判断できないため、そのまま投げ直します。
      if (!(error instanceof LLMApiError)) {
        throw error;
      }

      // レート制限とサーバーエラーのみリトライする
      if (error.status !== 429 && error.status < 500) {
        throw error;
      }

      lastError = error;
      if (attempt === maxRetries) {
        break;
      }

      const baseBackoff = Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);
      let waitMs = baseBackoff;

      // HTTPヘッダーは大文字小文字が揺れるため、小文字キーの辞書に変換してから参照します。
      const headerMap = error.headers
        ? Object.fromEntries(
            Object.entries(error.headers).map(([k, v]) => [k.toLowerCase(), v])
          )
        : null;

      if (headerMap) {
        const retryAfterMs = headerMap['retry-after-ms'];
        if (retryAfterMs) {
          const parsed = parseFloat(retryAfterMs);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed < MAX_BACKOFF_MS) {
            waitMs = parsed;
          }
        }

        if (waitMs === baseBackoff) {
          const retryAfter = headerMap['retry-after'];
          if (retryAfter) {
            const seconds = parseFloat(retryAfter);
            let parsed: number | null = null;
            if (!Number.isNaN(seconds)) {
              parsed = seconds * 1000;
            } else {
              const date = new Date(retryAfter);
              if (!Number.isNaN(date.getTime())) {
                parsed = date.getTime() - Date.now();
              }
            }
            if (parsed !== null && parsed >= 0 && parsed < MAX_BACKOFF_MS) {
              waitMs = parsed;
            }
          }
        }
      }

      // setTimeout を Promise で包むと、await で指定ミリ秒だけ待てます。
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}
