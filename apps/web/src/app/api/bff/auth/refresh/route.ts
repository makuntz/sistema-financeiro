import { NextResponse } from 'next/server';
import { refreshOnce } from '@/server/bff/session';

export async function POST() {
  const newToken = await refreshOnce();
  if (!newToken) {
    return NextResponse.json({ error: 'Unable to refresh' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
