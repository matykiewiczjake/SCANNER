const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch JSON with AbortController timeout and exponential backoff
 * on network errors / 5xx / 429. Throws on persistent failure so the
 * caller can convert to UNKNOWN.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, ...rest } = init;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        signal: ctrl.signal,
        headers: {
          accept: "application/json",
          ...(rest.headers ?? {}),
        },
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
      } else if (!res.ok) {
        // 4xx (except 429) — don't retry, these are permanent.
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      } else {
        return (await res.json()) as T;
      }
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      // 400ms, 800ms, 1600ms
      await sleep(400 * Math.pow(2, attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
