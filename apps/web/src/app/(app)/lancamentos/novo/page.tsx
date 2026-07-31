'use client';

import { Suspense } from 'react';
import { NovoLancamentoPage } from '@/features/ledger/novo-lancamento-page';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-header">
          <div>
            <h1>Novo lançamento</h1>
            <p>Carregando…</p>
          </div>
        </div>
      }
    >
      <NovoLancamentoPage />
    </Suspense>
  );
}
