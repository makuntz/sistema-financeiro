import { authenticatedProxy } from '@/server/bff/proxy';

export async function GET() {
  return authenticatedProxy('/v1/members', { skipOriginCheck: true });
}
