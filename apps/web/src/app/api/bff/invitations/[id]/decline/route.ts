import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: token } = await params;
  return authenticatedProxy(`/v1/invitations/${encodeURIComponent(token)}/decline`, {
    method: 'POST',
  });
}
