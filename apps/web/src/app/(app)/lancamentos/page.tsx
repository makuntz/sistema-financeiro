'use client';

import { Suspense } from 'react';
import { LancamentosPage } from '@/features/ledger/lancamentos-page';

export default function LancamentosRoute() {
  return (
    <Suspense
      fallback={
        <div className="page-header">
          <div>
            <h1>Lançamentos</h1>
            <p>Carregando…</p>
          </div>
        </div>
      }
    >
      <LancamentosPage />
    </Suspense>
  );
}
