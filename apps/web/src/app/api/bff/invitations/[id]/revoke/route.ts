import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return authenticatedProxy(
    `/v1/workspaces/current/invitations/${encodeURIComponent(id)}/revoke`,
    { method: 'POST' },
  );
}
