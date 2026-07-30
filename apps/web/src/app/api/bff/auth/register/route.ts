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
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Nome, email e senha são obrigatórios' },
      { status: 400 },
    );
  }

  const res = await apiFetch('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.message ?? 'Erro ao criar conta' },
      { status: res.status },
    );
  }

  await setAuthCookies(data.accessToken, data.refreshToken);

  if (data.workspace?.id) {
    await setWorkspaceCookie(data.workspace.id);
  }

  return NextResponse.json({ user: data.user, workspace: data.workspace });
}
