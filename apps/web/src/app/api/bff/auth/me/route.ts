import { NextResponse } from 'next/server';
import { apiFetch } from '@/server/bff/api';
import { getAccessToken, getWorkspaceId } from '@/server/bff/cookies';
import { refreshOnce } from '@/server/bff/session';

export async function GET() {
  let accessToken: string | null | undefined = await getAccessToken();
  const workspaceId = await getWorkspaceId();

  if (!accessToken) {
    accessToken = await refreshOnce();
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let res = await apiFetch('/v1/auth/me', {
    method: 'GET',
    accessToken,
    workspaceId: workspaceId ?? undefined,
  });

  if (res.status === 401) {
    const newToken = await refreshOnce();
    if (!newToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    res = await apiFetch('/v1/auth/me', {
      method: 'GET',
      accessToken: newToken,
      workspaceId: workspaceId ?? undefined,
    });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
