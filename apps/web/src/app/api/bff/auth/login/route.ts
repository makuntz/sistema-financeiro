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
  workspaceId?: string;
};

function extractTokens(
  data: AuthTokensPayload,
): { accessToken: string; refreshToken: string } | null {
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
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
  }

  const res = await apiFetch('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as AuthTokensPayload & {
    error?: { message?: string };
    message?: string;
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error?.message ?? data.message ?? 'Credenciais inválidas' },
      { status: res.status },
    );
  }

  const tokens = extractTokens(data);
  if (!tokens) {
    return NextResponse.json({ error: 'Resposta de autenticação inválida' }, { status: 502 });
  }

  await setAuthCookies(tokens.accessToken, tokens.refreshToken);

  let workspaceId = data.workspaceId ?? data.workspace?.id;
  if (!workspaceId) {
    const workspacesRes = await apiFetch('/v1/workspaces', {
      accessToken: tokens.accessToken,
    });
    if (workspacesRes.ok) {
      const payload = (await workspacesRes.json()) as
        | Array<{ id?: string; workspace?: { id?: string } }>
        | { data?: Array<{ id?: string; workspace?: { id?: string } }> };
      const list = Array.isArray(payload) ? payload : (payload.data ?? []);
      const first = list[0];
      workspaceId = first?.workspace?.id ?? first?.id;
    }
  }

  if (workspaceId) {
    await setWorkspaceCookie(workspaceId);
  }

  return NextResponse.json({ user: data.user });
}
