'use client';

import Link from 'next/link';
import { formatCentsToBRL } from '@pp-planning/contracts';
import { Copy, Info, Plus } from 'lucide-react';
import { formatSharePercent } from './planning-metrics';
import type { PlanningTab } from '@/lib/planning-period';

type PlanningSidePanelProps = {
  tab: Exclude<PlanningTab, 'resumo'>;
  canWrite: boolean;
  copying: boolean;
  incomePlannedInCents: string;
  expensePlannedInCents: string;
  categoryCount: number;
  subcategoryCount: number;
  positiveBalanceCount?: number;
  onCopyPrevious: () => void;
};

export function PlanningSidePanel({
  tab,
  canWrite,
  copying,
  incomePlannedInCents,
  expensePlannedInCents,
  categoryCount,
  subcategoryCount,
  positiveBalanceCount,
  onCopyPrevious,
}: PlanningSidePanelProps) {
  const isIncome = tab === 'receitas';
  const total = isIncome ? incomePlannedInCents : expensePlannedInCents;
  const expenseShare = formatSharePercent(expensePlannedInCents, incomePlannedInCents);

  return (
    <aside className="planning-side-panel" aria-label="Resumo da edição">
      <section className="panel planning-side-block">
        <h2>Resumo da edição</h2>
        <div className="planning-side-total">
          <span className="planning-side-total-label">
            {isIncome ? 'Total receitas planejadas' : 'Total distribuído'}
          </span>
          <span className={`planning-side-total-value${isIncome ? ' is-income' : ''}`}>
            {formatCentsToBRL(total)}
          </span>
          {!isIncome ? (
            <span className="planning-side-stat-hint">{expenseShare} dos gastos planejados</span>
          ) : null}
        </div>

        <dl className="planning-side-stats">
          {isIncome ? (
            <>
              <div>
                <dt>Receitas recorrentes (mensais)</dt>
                <dd>
                  <strong>{formatCentsToBRL(incomePlannedInCents)}</strong>
                  <span className="planning-side-stat-hint">referência do mês</span>
                </dd>
              </div>
              <div>
                <dt>Fontes cadastradas</dt>
                <dd>
                  <strong>{categoryCount}</strong>
                  <span className="planning-side-stat-hint">
                    {subcategoryCount} {subcategoryCount === 1 ? 'item' : 'itens'}
                  </span>
                </dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Categorias com saldo positivo</dt>
                <dd>
                  <strong>
                    {positiveBalanceCount ?? categoryCount} de {categoryCount}
                  </strong>
                  <span className="planning-side-stat-hint">categorias</span>
                </dd>
              </div>
              <div>
                <dt>Subcategorias</dt>
                <dd>
                  <strong>{subcategoryCount}</strong>
                  <span className="planning-side-stat-hint">no planejamento</span>
                </dd>
              </div>
            </>
          )}
        </dl>

        {!isIncome ? (
          <div className="planning-side-info is-inline" role="note">
            <Info size={16} aria-hidden="true" />
            <p>O valor da categoria é a soma das subcategorias.</p>
          </div>
        ) : null}
      </section>

      <section className="panel planning-side-block">
        <h2>Ações rápidas</h2>
        <div className="planning-side-actions">
          <Link href="/configuracoes/categorias" className="planning-side-link-btn">
            <Plus size={16} aria-hidden="true" />
            {isIncome ? 'Adicionar fonte' : 'Adicionar subcategoria'}
          </Link>
          {canWrite ? (
            <button
              type="button"
              className="planning-side-link-btn"
              onClick={onCopyPrevious}
              disabled={copying}
            >
              <Copy size={16} aria-hidden="true" />
              {isIncome ? 'Aplicar modelo do mês anterior' : 'Duplicar distribuição'}
            </button>
          ) : null}
        </div>
      </section>

      {isIncome ? (
        <div className="planning-side-info" role="note">
          <Info size={16} aria-hidden="true" />
          <p>
            Valores planejados são editáveis. Os realizados são atualizados automaticamente com base
            nos lançamentos.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
