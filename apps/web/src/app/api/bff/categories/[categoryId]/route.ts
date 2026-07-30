import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/categories/${categoryId}`, { method: 'PATCH', body });
}
