import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

type Params = { params: Promise<{ entryId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { entryId } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/ledger/entries/${entryId}/restore`, { method: 'POST', body });
}
