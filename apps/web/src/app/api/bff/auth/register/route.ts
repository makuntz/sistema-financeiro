import { NextResponse } from 'next/server';
import { apiFetch } from '@/server/bff/api';
import { setAuthCookies, setWorkspaceCookie } from '@/server/bff/cookies';
import { validateOrigin } from '@/server/bff/origin';

type AuthTokensPayload = {
  accessToken?: string;
  refreshToken?: string;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
  user?: unknown;
  workspace?: { id?: string };
};

function extractTokens(data: AuthTokensPayload): { accessToken: string; refreshToken: string } | null {
  const accessToken = data.tokens?.accessToken ?? data.accessToken;
  const refreshToken = data.tokens?.refreshToken ?? data.refreshToken;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function POST(request: Request) {
  const validOrigin = await validateOrigin();
  if (!validOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
  }

  const res = await apiFetch('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  const data = (await res.json()) as AuthTokensPayload & {
    error?: { message?: string };
    message?: string;
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error?.message ?? data.message ?? 'Erro ao criar conta' },
      { status: res.status },
    );
  }

  const tokens = extractTokens(data);
  if (!tokens) {
    return NextResponse.json({ error: 'Resposta de autenticação inválida' }, { status: 502 });
  }

  await setAuthCookies(tokens.accessToken, tokens.refreshToken);

  if (data.workspace?.id) {
    await setWorkspaceCookie(data.workspace.id);
  }

  return NextResponse.json({ user: data.user, workspace: data.workspace });
}
