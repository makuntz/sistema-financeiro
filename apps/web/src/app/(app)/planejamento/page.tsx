'use client';

import { Suspense } from 'react';
import PlanejamentoPage from './planejamento-client';

export default function PlanejamentoRoute() {
  return (
    <Suspense
      fallback={
        <div className="page-header">
          <div>
            <h1>Planejamento mensal</h1>
            <p>Carregando…</p>
          </div>
        </div>
      }
    >
      <PlanejamentoPage />
    </Suspense>
  );
}
