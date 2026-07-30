import { cookies } from 'next/headers';

/**
 * Cookie names used by the BFF layer:
 * - pp_access_token: HttpOnly, SameSite=Lax, Path=/, maxAge = access TTL (~15min)
 * - pp_refresh_token: HttpOnly, SameSite=Lax, Path=/ (same-origin; Path is not a security boundary)
 * - pp_workspace_id: NOT HttpOnly (readable by client for UI), Path=/, SameSite=Lax
 *
 * Secure flag is set when NODE_ENV=production.
 * Domain is never set (host-only cookies).
 *
 * Note: Path=/api/bff/auth was rejected because the browser would not send the
 * refresh cookie on domain BFF routes (/api/bff/categories, /api/bff/planning, …)
 * or to middleware for authenticated pages, so expired access tokens could not
 * be renewed. HttpOnly remains the real protection against XSS token theft.
 */

const COOKIE_ACCESS = 'pp_access_token';
const COOKIE_REFRESH = 'pp_refresh_token';
const COOKIE_WORKSPACE = 'pp_workspace_id';

const isProduction = process.env.NODE_ENV === 'production';
const ACCESS_MAX_AGE = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
const REFRESH_MAX_AGE = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86400;

/** Refresh cookie path — must match set and clear. */
export const REFRESH_COOKIE_PATH = '/';

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();

  jar.set(COOKIE_ACCESS, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
    secure: isProduction,
  });

  jar.set(COOKIE_REFRESH, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_MAX_AGE,
    secure: isProduction,
  });
}

export async function setWorkspaceCookie(workspaceId: string) {
  const jar = await cookies();
  jar.set(COOKIE_WORKSPACE, workspaceId, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
    secure: isProduction,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(COOKIE_ACCESS);
  jar.delete({ name: COOKIE_REFRESH, path: REFRESH_COOKIE_PATH });
  jar.delete(COOKIE_WORKSPACE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_ACCESS)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_REFRESH)?.value;
}

export async function getWorkspaceId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_WORKSPACE)?.value;
}
