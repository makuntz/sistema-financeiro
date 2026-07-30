import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ subcategoryId: string }> },
) {
  const { subcategoryId } = await params;
  return authenticatedProxy(`/v1/subcategories/${subcategoryId}/reactivate`, { method: 'POST' });
}
