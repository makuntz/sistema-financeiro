import { authenticatedProxy } from '@/server/bff/proxy';

export async function POST() {
  return authenticatedProxy('/v1/workspaces/current/leave', { method: 'POST' });
}
