import { NextResponse } from 'next/server';
import { apiFetch } from './api';
import { clearAuthCookies, getWorkspaceId } from './cookies';
import { validateOrigin } from './origin';
import { getValidAccessToken, refreshOnce } from './session';

/**
 * Proxy helper for BFF routes. Calls the Fastify API with auth from cookies.
 * Retries once on 401 by refreshing the access token (no refresh loop).
 * Validates Origin for mutating methods.
 *
 * Authorization and X-Workspace-Id always come from BFF cookies — never from
 * browser-supplied headers for these values.
 */
export async function authenticatedProxy(
  apiPath: string,
  options: {
    method?: string;
    body?: unknown;
    query?: string;
    skipOriginCheck?: boolean;
  } = {},
): Promise<NextResponse> {
  const { method = 'GET', body, query, skipOriginCheck } = options;

  if (!skipOriginCheck && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const validOrigin = await validateOrigin();
    if (!validOrigin) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    await clearAuthCookies();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId();
  const fullPath = query ? `${apiPath}?${query}` : apiPath;
  const serializedBody = body !== undefined ? JSON.stringify(body) : undefined;

  let res = await apiFetch(fullPath, {
    method,
    accessToken,
    workspaceId: workspaceId ?? undefined,
    body: serializedBody,
  });

  if (res.status === 401) {
    const newToken = await refreshOnce();
    if (!newToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    res = await apiFetch(fullPath, {
      method,
      accessToken: newToken,
      workspaceId: workspaceId ?? undefined,
      body: serializedBody,
    });
  }

  const responseData = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  const json = NextResponse.json(responseData, { status: res.status });
  // Never forward Set-Cookie from the API; auth cookies are managed only by the BFF.
  return json;
}
