import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subcategoryId: string }> },
) {
  const { subcategoryId } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/subcategories/${subcategoryId}`, { method: 'PATCH', body });
}
