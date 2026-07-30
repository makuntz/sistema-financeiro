import { type NextRequest } from 'next/server';
import { authenticatedProxy } from '@/server/bff/proxy';

type Params = { params: Promise<{ year: string; month: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { year, month } = await params;
  const body = await request.json();
  return authenticatedProxy(`/v1/planning/monthly/${year}/${month}/copy-previous`, {
    method: 'POST',
    body,
  });
}
