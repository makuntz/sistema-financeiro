import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function GET() {
  return authenticatedProxy('/v1/workspaces/current', { skipOriginCheck: true });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  return authenticatedProxy('/v1/workspaces/current', { method: 'PATCH', body });
}
