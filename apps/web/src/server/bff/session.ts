import { createHash } from 'node:crypto';
import { apiFetch } from './api';
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from './cookies';

type RefreshResult = string | null;

/**
 * In-process deduplication of concurrent refresh calls for the *same* session.
 * Keyed by SHA-256 of the refresh token so different users never share a Promise.
 * Entries are removed in `finally`. Never log the token or the hash.
 */
const refreshByTokenHash = new Map<string, Promise<RefreshResult>>();

const REFRESH_RETRY_ATTEMPTS = 4;
const REFRESH_RETRY_DELAY_MS = process.env.VITEST ? 1 : 250;

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRefreshFailure(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Refresh the access token using the refresh cookie for the current request.
 * Concurrent callers that share the same refresh token coalesce into one HTTP refresh.
 * Distinct sessions never share a Promise.
 *
 * Cookies are never cleared here on refresh failure. Parallel BFF calls often race
 * after refresh-token rotation: the losing request gets 401 with the previous token.
 * Clearing cookies on that 401 would wipe the winner's new Set-Cookie and force login
 * after every API/web restart. Logout is the only path that clears auth cookies.
 *
 * Network errors and 5xx are retried briefly so a local API boot does not fail the
 * first page load after restart.
 */
export async function refreshOnce(): Promise<RefreshResult> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return null;
  }

  const key = hashRefreshToken(refreshToken);
  const existing = refreshByTokenHash.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<RefreshResult> => {
    for (let attempt = 1; attempt <= REFRESH_RETRY_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        res = await apiFetch('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // API unreachable (e.g. still booting after a local restart).
        if (attempt < REFRESH_RETRY_ATTEMPTS) {
          await sleep(REFRESH_RETRY_DELAY_MS * attempt);
          continue;
        }
        return null;
      }

      if (!res.ok) {
        if (isTransientRefreshFailure(res.status) && attempt < REFRESH_RETRY_ATTEMPTS) {
          await sleep(REFRESH_RETRY_DELAY_MS * attempt);
          continue;
        }
        // Keep cookies: rotation races and brief API outages must not log the user out.
        return null;
      }

      const data = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
        tokens?: { accessToken?: string; refreshToken?: string };
      };
      const accessToken = data.tokens?.accessToken ?? data.accessToken;
      const nextRefreshToken = data.tokens?.refreshToken ?? data.refreshToken;
      if (!accessToken || !nextRefreshToken) {
        return null;
      }
      await setAuthCookies(accessToken, nextRefreshToken);
      return accessToken;
    }

    return null;
  })();

  refreshByTokenHash.set(key, promise);

  try {
    return await promise;
  } finally {
    refreshByTokenHash.delete(key);
  }
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (token) return token;
  return refreshOnce();
}

/** Test-only: inspect in-flight refresh map size (never exposes keys). */
export function __refreshInflightCountForTests(): number {
  return refreshByTokenHash.size;
}
