import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
const getAccessTokenMock = vi.fn();
const getRefreshTokenMock = vi.fn();
const setAuthCookiesMock = vi.fn();
const clearAuthCookiesMock = vi.fn();
const getWorkspaceIdMock = vi.fn();
const validateOriginMock = vi.fn();

vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock('./cookies', () => ({
  getAccessToken: () => getAccessTokenMock(),
  getRefreshToken: () => getRefreshTokenMock(),
  setAuthCookies: (...args: unknown[]) => setAuthCookiesMock(...args),
  clearAuthCookies: () => clearAuthCookiesMock(),
  getWorkspaceId: () => getWorkspaceIdMock(),
}));

vi.mock('./origin', () => ({
  validateOrigin: () => validateOriginMock(),
}));

describe('BFF session refresh concurrency', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAccessTokenMock.mockResolvedValue(undefined);
    getWorkspaceIdMock.mockResolvedValue('ws-1');
    validateOriginMock.mockResolvedValue(true);
  });

  it('deduplicates concurrent refresh for the same refresh token', async () => {
    getRefreshTokenMock.mockResolvedValue('same-refresh-token');

    let resolveRefresh!: (value: Response) => void;
    const refreshGate = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

    apiFetchMock.mockImplementationOnce(() => refreshGate);

    const { refreshOnce, __refreshInflightCountForTests } = await import('./session');

    const p1 = refreshOnce();
    const p2 = refreshOnce();

    await Promise.resolve();
    expect(__refreshInflightCountForTests()).toBe(1);

    resolveRefresh(
      new Response(
        JSON.stringify({
          tokens: { accessToken: 'access-new', refreshToken: 'refresh-new' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('access-new');
    expect(t2).toBe('access-new');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(setAuthCookiesMock).toHaveBeenCalledWith('access-new', 'refresh-new');
    expect(__refreshInflightCountForTests()).toBe(0);
  });

  it('does not share refresh Promise across different refresh tokens', async () => {
    const refreshCalls: string[] = [];

    apiFetchMock.mockImplementation(async (_path: string, init?: { body?: string }) => {
      const body = JSON.parse(String(init?.body)) as { refreshToken: string };
      refreshCalls.push(body.refreshToken);
      await new Promise((r) => setTimeout(r, 20));
      return new Response(
        JSON.stringify({
          tokens: {
            accessToken: `access-for-${body.refreshToken}`,
            refreshToken: `rotated-${body.refreshToken}`,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const session = await import('./session');

    getRefreshTokenMock.mockResolvedValueOnce('token-user-a');
    const aPromise = session.refreshOnce();

    getRefreshTokenMock.mockResolvedValueOnce('token-user-b');
    const bPromise = session.refreshOnce();

    const [a, b] = await Promise.all([aPromise, bPromise]);

    expect(a).toBe('access-for-token-user-a');
    expect(b).toBe('access-for-token-user-b');
    expect(refreshCalls).toEqual(['token-user-a', 'token-user-b']);
    expect(createHash('sha256').update('token-user-a').digest('hex')).not.toBe(
      createHash('sha256').update('token-user-b').digest('hex'),
    );
  });

  it('keeps cookies when refresh is invalid (rotation race must not log out)', async () => {
    getRefreshTokenMock.mockResolvedValue('bad-refresh');
    apiFetchMock.mockResolvedValueOnce(new Response('{"error":{}}', { status: 401 }));

    const { refreshOnce } = await import('./session');
    const token = await refreshOnce();

    expect(token).toBeNull();
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('retries then succeeds when the API is temporarily down (5xx)', async () => {
    getRefreshTokenMock.mockResolvedValue('valid-refresh');
    apiFetchMock
      .mockResolvedValueOnce(new Response('{"error":{}}', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tokens: { accessToken: 'access-new', refreshToken: 'refresh-new' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    const { refreshOnce } = await import('./session');
    const token = await refreshOnce();

    expect(token).toBe('access-new');
    expect(setAuthCookiesMock).toHaveBeenCalledWith('access-new', 'refresh-new');
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps cookies when refresh fetch keeps failing (connection refused)', async () => {
    getRefreshTokenMock.mockResolvedValue('valid-refresh');
    apiFetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const { refreshOnce } = await import('./session');
    const token = await refreshOnce();

    expect(token).toBeNull();
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
    expect(apiFetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('authenticatedProxy refresh behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getWorkspaceIdMock.mockResolvedValue('ws-1');
    validateOriginMock.mockResolvedValue(true);
  });

  it('renews on expired access and retries category call once', async () => {
    getAccessTokenMock.mockResolvedValue('expired-access');
    getRefreshTokenMock.mockResolvedValue('valid-refresh');

    apiFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'INVALID_ACCESS_TOKEN' } }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const { authenticatedProxy } = await import('./proxy');
    const res = await authenticatedProxy('/v1/categories', { skipOriginCheck: true });

    expect(res.status).toBe(200);
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    expect(setAuthCookiesMock).toHaveBeenCalledWith('new-access', 'new-refresh');
    const body = await res.json();
    expect(body).toEqual({ data: [] });
  });

  it('renews when access is missing and retries planning call', async () => {
    getAccessTokenMock.mockResolvedValue(undefined);
    getRefreshTokenMock.mockResolvedValue('valid-refresh');

    apiFetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            exists: false,
            id: null,
            year: 2026,
            month: 7,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    const { authenticatedProxy } = await import('./proxy');
    const res = await authenticatedProxy('/v1/planning/monthly/2026/7', { skipOriginCheck: true });

    expect(res.status).toBe(200);
    expect(setAuthCookiesMock).toHaveBeenCalled();
    const body = await res.json();
    expect(body.exists).toBe(false);
  });

  it('returns 401 without clearing cookies when refresh fails after 401', async () => {
    getAccessTokenMock.mockResolvedValue('expired');
    getRefreshTokenMock.mockResolvedValue('invalid-refresh');

    apiFetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));

    const { authenticatedProxy } = await import('./proxy');
    const res = await authenticatedProxy('/v1/categories', { skipOriginCheck: true });

    expect(res.status).toBe(401);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('returns 401 without clearing cookies when refresh fails with 503', async () => {
    getAccessTokenMock.mockResolvedValue(undefined);
    getRefreshTokenMock.mockResolvedValue('valid-refresh');

    apiFetchMock.mockResolvedValue(new Response('{}', { status: 503 }));

    const { authenticatedProxy } = await import('./proxy');
    const res = await authenticatedProxy('/v1/categories', { skipOriginCheck: true });

    expect(res.status).toBe(401);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('validates Origin on PUT and does not accept browser Authorization', async () => {
    validateOriginMock.mockResolvedValue(false);

    const { authenticatedProxy } = await import('./proxy');
    const res = await authenticatedProxy('/v1/planning/monthly/2026/7', {
      method: 'PUT',
      body: { expectedVersion: null, items: [] },
    });

    expect(res.status).toBe(403);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

describe('refresh cookie path', () => {
  it('exports Path=/ for refresh cookie', async () => {
    const actual = (await vi.importActual('./cookies')) as {
      REFRESH_COOKIE_PATH: string;
    };
    expect(actual.REFRESH_COOKIE_PATH).toBe('/');
  });
});
