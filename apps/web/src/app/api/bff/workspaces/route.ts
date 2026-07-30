import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function GET() {
  return authenticatedProxy('/v1/workspaces', { skipOriginCheck: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return authenticatedProxy('/v1/workspaces', { method: 'POST', body });
}
