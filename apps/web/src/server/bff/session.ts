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

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Refresh the access token using the refresh cookie for the current request.
 * Concurrent callers that share the same refresh token coalesce into one HTTP refresh.
 * Distinct sessions never share a Promise.
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
    const res = await apiFetch('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearAuthCookies();
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
      await clearAuthCookies();
      return null;
    }
    await setAuthCookies(accessToken, nextRefreshToken);
    return accessToken;
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
