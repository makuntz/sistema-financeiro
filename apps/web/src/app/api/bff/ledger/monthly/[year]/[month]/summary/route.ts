import { authenticatedProxy } from '@/server/bff/proxy';

type Params = { params: Promise<{ year: string; month: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { year, month } = await params;
  return authenticatedProxy(`/v1/ledger/monthly/${year}/${month}/summary`, {
    skipOriginCheck: true,
  });
}
