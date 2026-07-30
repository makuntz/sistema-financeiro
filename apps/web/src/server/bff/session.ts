import { apiFetch } from './api';
import { getAccessToken, getRefreshToken, setAuthCookies } from './cookies';

let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh the access token using the refresh cookie.
 * Uses a mutex to avoid parallel refresh calls within a single request.
 */
export async function refreshOnce(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const res = await apiFetch('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    await setAuthCookies(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
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
