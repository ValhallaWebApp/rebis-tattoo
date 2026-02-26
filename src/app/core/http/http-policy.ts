import { MonoTypeOperatorFunction, retry, throwError, timeout, timer } from 'rxjs';

export type CriticalHttpPolicyOptions = {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
};

type RetryableHttpError = {
  status?: unknown;
  name?: unknown;
};

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 400;

function isRetryableHttpError(error: unknown): boolean {
  const e = (error ?? {}) as RetryableHttpError;
  const status = Number(e.status ?? 0);
  const timeoutLike = String(e.name ?? '') === 'TimeoutError';
  if (timeoutLike) return true;
  if (status === 0) return true;
  if (status >= 500) return true;
  return false;
}

export function withCriticalHttpPolicy<T>(
  options: CriticalHttpPolicyOptions = {}
): MonoTypeOperatorFunction<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryCount = options.retryCount ?? DEFAULT_RETRY_COUNT;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  return (source) =>
    source.pipe(
      timeout(timeoutMs),
      retry({
        count: retryCount,
        delay: (error, retryIndex) => {
          if (!isRetryableHttpError(error)) {
            return throwError(() => error);
          }
          const delayMs = Math.min(retryDelayMs * (retryIndex + 1), 2000);
          return timer(delayMs);
        }
      })
    );
}
