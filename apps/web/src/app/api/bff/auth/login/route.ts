import { NextResponse } from 'next/server';
import { apiFetch } from '@/server/bff/api';
import { setAuthCookies, setWorkspaceCookie } from '@/server/bff/cookies';
import { validateOrigin } from '@/server/bff/origin';

export async function POST(request: Request) {
  const validOrigin = await validateOrigin();
  if (!validOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
  }

  const res = await apiFetch('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.message ?? 'Credenciais inválidas' },
      { status: res.status },
    );
  }

  await setAuthCookies(data.accessToken, data.refreshToken);

  if (data.workspaceId) {
    await setWorkspaceCookie(data.workspaceId);
  }

  return NextResponse.json({ user: data.user });
}
