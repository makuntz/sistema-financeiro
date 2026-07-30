import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  const query = request.nextUrl.searchParams.toString();
  return authenticatedProxy(`/v1/categories/${categoryId}/subcategories`, {
    skipOriginCheck: true,
    query,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/categories/${categoryId}/subcategories`, {
    method: 'POST',
    body,
  });
}
