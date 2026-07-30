import { NextResponse } from 'next/server';
import { apiFetch } from './api';
import { getWorkspaceId } from './cookies';
import { validateOrigin } from './origin';
import { getValidAccessToken, refreshOnce } from './session';

/**
 * Proxy helper for BFF routes. Calls the Fastify API with auth from cookies.
 * Retries once on 401 by refreshing the access token.
 * Validates Origin for mutating methods.
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId();
  const fullPath = query ? `${apiPath}?${query}` : apiPath;

  let res = await apiFetch(fullPath, {
    method,
    accessToken,
    workspaceId: workspaceId ?? undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const newToken = await refreshOnce();
    if (newToken) {
      res = await apiFetch(fullPath, {
        method,
        accessToken: newToken,
        workspaceId: workspaceId ?? undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  const responseData = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  return NextResponse.json(responseData, { status: res.status });
}
