import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

type Params = { params: Promise<{ year: string; month: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { year, month } = await params;
  return authenticatedProxy(`/v1/planning/monthly/${year}/${month}`, { skipOriginCheck: true });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { year, month } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/planning/monthly/${year}/${month}`, {
    method: 'PUT',
    body,
  });
}
