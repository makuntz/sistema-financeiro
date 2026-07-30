import { NextResponse } from 'next/server';
import { setWorkspaceCookie } from '@/server/bff/cookies';
import { validateOrigin } from '@/server/bff/origin';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function POST(request: Request) {
  const validOrigin = await validateOrigin();
  if (!validOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const body = await request.json();
  const { workspaceId } = body;

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId é obrigatório' }, { status: 400 });
  }

  // Validate workspace belongs to user by checking their list
  const listRes = await authenticatedProxy('/v1/workspaces', { skipOriginCheck: true });
  const listData = await listRes.json();

  if (Array.isArray(listData)) {
    const found = listData.find((w: { id: string }) => w.id === workspaceId);
    if (!found) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
    }
  }

  await setWorkspaceCookie(workspaceId);
  return NextResponse.json({ ok: true, workspaceId });
}
