import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

type Params = { params: Promise<{ entryId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { entryId } = await params;
  return authenticatedProxy(`/v1/ledger/entries/${entryId}`, { skipOriginCheck: true });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { entryId } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/ledger/entries/${entryId}`, { method: 'PATCH', body });
}
