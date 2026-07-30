import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
  return authenticatedProxy(`/v1/members/${memberId}`, { method: 'DELETE' });
}
