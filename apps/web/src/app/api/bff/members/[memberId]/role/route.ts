import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/members/${memberId}/role`, { method: 'PATCH', body });
}
