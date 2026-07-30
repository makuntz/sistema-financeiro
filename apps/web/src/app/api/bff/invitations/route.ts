import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function GET() {
  return authenticatedProxy('/v1/invitations', { skipOriginCheck: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return authenticatedProxy('/v1/invitations', { method: 'POST', body });
}
