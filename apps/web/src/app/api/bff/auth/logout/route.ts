import { NextResponse } from 'next/server';
import { apiFetch } from '@/server/bff/api';
import { clearAuthCookies, getAccessToken, getRefreshToken } from '@/server/bff/cookies';
import { validateOrigin } from '@/server/bff/origin';

export async function POST() {
  const validOrigin = await validateOrigin();
  if (!validOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (accessToken && refreshToken) {
    try {
      await apiFetch('/v1/auth/logout', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Always clear cookies even if API call fails
    }
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
