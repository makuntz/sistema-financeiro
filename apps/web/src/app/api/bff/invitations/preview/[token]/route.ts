import { type NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/server/bff/api';

// Public endpoint — no auth required
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const res = await apiFetch(`/v1/invitations/preview/${token}`, { method: 'GET' });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data);
}
