import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  return authenticatedProxy('/v1/ledger/entries', { skipOriginCheck: true, query });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return authenticatedProxy('/v1/ledger/entries', { method: 'POST', body });
}
