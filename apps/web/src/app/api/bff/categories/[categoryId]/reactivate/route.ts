import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  return authenticatedProxy(`/v1/categories/${categoryId}/reactivate`, { method: 'POST' });
}
