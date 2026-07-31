'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, MoneyDisplay } from '@pp-planning/ui-web';
import { formatCentsToBRL } from '@pp-planning/contracts';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { CategoryIconBadge } from '@/lib/category-icons';
import {
  buildPlanningHref,
  formatMonthTitle,
  parsePlanningSearchParams,
  shiftMonth,
} from '@/lib/planning-period';
import { formatMonthPeriod, formatSharePercent, usagePercent } from '@/features/planning/planning-metrics';

type BudgetCategory = {
  categoryId: string;
  categoryName: string;
  kind: 'income' | 'expense';
  plannedInCents: string;
  realizedInCents: string;
  differenceInCents: string;
};

type BudgetComparison = {
  totalPlannedIncomeInCents: string;
  totalRealizedIncomeInCents: string;
  totalPlannedExpenseInCents: string;
  totalRealizedExpenseInCents: string;
  projectedBalanceInCents?: string;
  realizedBalanceInCents?: string;
  categories?: BudgetCategory[];
};

type RecentEntry = {
  id: string;
  description: string;
  kind: 'income' | 'expense';
  amountInCents: string;
  occurredOn: string;
  categoryName: string;
  subcategoryName: string;
};

type MonthPoint = {
  key: string;
  label: string;
  planned: number;
  realized: number;
};

function formatDisplayDate(dateOnly: string): string {
  const [, m, d] = dateOnly.split('-');
  return `${d}/${m}`;
}

function DonutChart({
  percent,
  size = 88,
  stroke = 10,
  color = 'var(--action-primary)',
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(percent, 100));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="donut-chart-label">{label}</div>
    </div>
  );
}

function BarCompareChart({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.planned, p.realized]));
  return (
    <div className="bar-compare-chart" role="img" aria-label="Planejado versus realizado por mês">
      {points.map((point) => (
        <div key={point.key} className="bar-compare-col">
          <div className="bar-compare-bars">
            <span
              className="bar-compare-bar is-planned"
              style={{ height: `${(point.planned / max) * 100}%` }}
              title={`Planejado ${point.planned}`}
            />
            <span
              className="bar-compare-bar is-realized"
              style={{ height: `${(point.realized / max) * 100}%` }}
              title={`Realizado ${point.realized}`}
            />
          </div>
          <span className="bar-compare-label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function InicioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parsePlanningSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const year = parsed.year;
  const month = parsed.month;

  const [comparison, setComparison] = useState<BudgetComparison | null>(null);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [monthSeries, setMonthSeries] = useState<MonthPoint[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; color?: string; icon?: string; type: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const planningHref = buildPlanningHref(year, month, 'resumo');
  const lancamentosHref = `/lancamentos?ano=${year}&mes=${month}`;
  const novoHref = `/lancamentos/novo?ano=${year}&mes=${month}`;
  const period = formatMonthPeriod(year, month);

  useEffect(() => {
    setLoading(true);
    const seriesMonths = Array.from({ length: 6 }, (_, index) =>
      shiftMonth(year, month, index - 5),
    );

    Promise.all([
      fetch(`/api/bff/reports/monthly-budget/${year}/${month}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(
        `/api/bff/ledger/entries?competenceYear=${year}&competenceMonth=${month}&page=1&pageSize=6`,
      ).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/bff/categories').then((r) => (r.ok ? r.json() : null)),
      Promise.all(
        seriesMonths.map((point) =>
          fetch(`/api/bff/reports/monthly-budget/${point.year}/${point.month}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => ({
              key: `${point.year}-${point.month}`,
              label: formatMonthTitle(point.year, point.month).slice(0, 3),
              planned: Number(data?.totalPlannedExpenseInCents || '0') / 100,
              realized: Number(data?.totalRealizedExpenseInCents || '0') / 100,
            })),
        ),
      ),
    ])
      .then(([comparisonRes, ledgerRes, categoriesRes, series]) => {
        setComparison(comparisonRes as BudgetComparison | null);
        const entries = Array.isArray(ledgerRes?.data)
          ? ledgerRes.data
          : Array.isArray(ledgerRes?.items)
            ? ledgerRes.items
            : [];
        setRecentEntries(entries.slice(0, 6) as RecentEntry[]);
        const catArray = Array.isArray(categoriesRes)
          ? categoriesRes
          : Array.isArray(categoriesRes?.data)
            ? categoriesRes.data
            : [];
        setCategories(catArray);
        setMonthSeries(series);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [year, month]);

  const expenseCategories = useMemo(() => {
    const list = (comparison?.categories ?? []).filter((c) => c.kind === 'expense');
    return list
      .map((item) => {
        const meta = categories.find((c) => c.id === item.categoryId);
        return {
          ...item,
          color: meta?.color ?? '#2563EB',
          icon: meta?.icon ?? 'tag',
        };
      })
      .sort((a, b) => Number(BigInt(b.plannedInCents) - BigInt(a.plannedInCents)));
  }, [comparison, categories]);

  const budgetUsed = usagePercent(
    comparison?.totalPlannedExpenseInCents || '0',
    comparison?.totalRealizedExpenseInCents || '0',
  );
  const expenseShare = formatSharePercent(
    comparison?.totalPlannedExpenseInCents || '0',
    comparison?.totalPlannedIncomeInCents || '0',
  );
  const balanceShare = formatSharePercent(
    comparison?.projectedBalanceInCents ||
      (
        BigInt(comparison?.totalPlannedIncomeInCents || '0') -
        BigInt(comparison?.totalPlannedExpenseInCents || '0')
      ).toString(),
    comparison?.totalPlannedIncomeInCents || '0',
  );
  const projected =
    comparison?.projectedBalanceInCents ??
    (
      BigInt(comparison?.totalPlannedIncomeInCents || '0') -
      BigInt(comparison?.totalPlannedExpenseInCents || '0')
    ).toString();

  const donutTotal = expenseCategories.reduce(
    (acc, item) => acc + Number(BigInt(item.plannedInCents || '0')),
    0,
  );
  const donutSegments = expenseCategories.slice(0, 6).map((item, index) => {
    const value = Number(BigInt(item.plannedInCents || '0'));
    const pct = donutTotal > 0 ? (value / donutTotal) * 100 : 0;
    return { ...item, pct, hue: index };
  });

  function navigateMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    router.push(`/inicio?ano=${next.year}&mes=${next.month}`);
  }

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h1>Resumo Geral</h1>
          <p>Carregando o mês…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="resumo-page">
      <header className="planning-topbar">
        <div className="planning-topbar-title">
          <h1>Resumo Geral</h1>
          <p>Acompanhe o seu planejamento financeiro em um só lugar.</p>
        </div>

        <div className="planning-month-nav" aria-label="Navegação do mês">
          <Button variant="secondary" aria-label="Mês anterior" onClick={() => navigateMonth(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="planning-month-label">
            <CalendarDays size={16} aria-hidden />
            {formatMonthTitle(year, month)}
          </span>
          <Button variant="secondary" aria-label="Próximo mês" onClick={() => navigateMonth(1)}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="planning-topbar-actions">
          <Link href={novoHref}>
            <Button>
              <Plus size={16} /> Novo lançamento
            </Button>
          </Link>
        </div>
      </header>

      <div className="stat-grid planning-summary-cards">
        <article className="stat-card is-income">
          <div className="stat-card-label">
            <span className="planning-card-icon is-income" aria-hidden>
              <Wallet size={16} />
            </span>
            Receitas planejadas
          </div>
          <div className="stat-card-value is-income">
            {formatCentsToBRL(comparison?.totalPlannedIncomeInCents || '0')}
          </div>
          <div className="stat-card-hint is-income">100% do previsto</div>
        </article>

        <article className="stat-card is-expense">
          <div className="stat-card-label">
            <span className="planning-card-icon is-expense" aria-hidden>
              <ShoppingCart size={16} />
            </span>
            Gastos planejados
          </div>
          <div className="stat-card-value is-expense">
            {formatCentsToBRL(comparison?.totalPlannedExpenseInCents || '0')}
          </div>
          <div className="stat-card-hint is-expense">{expenseShare} do previsto</div>
        </article>

        <article className="stat-card is-balance">
          <div className="stat-card-label">
            <span className="planning-card-icon is-balance" aria-hidden>
              <BarChart3 size={16} />
            </span>
            Saldo previsto
          </div>
          <div className="stat-card-value is-balance">{formatCentsToBRL(projected)}</div>
          <div className="stat-card-hint is-balance">{balanceShare} do previsto</div>
        </article>

        <article className="stat-card is-period">
          <div className="stat-card-label">
            <span className="planning-card-icon is-period" aria-hidden>
              <Target size={16} />
            </span>
            % do orçamento utilizado
          </div>
          <div className="resumo-budget-used">
            <DonutChart
              percent={budgetUsed}
              label={`${budgetUsed.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}
              color="var(--action-primary)"
              size={72}
              stroke={8}
            />
            <div className="stat-card-hint">{budgetUsed.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do orçamento total</div>
          </div>
        </article>
      </div>

      <div className="resumo-grid-3">
        <section className="panel">
          <div className="panel-heading">
            <h2>Planejado vs realizado</h2>
            <span className="panel-legend">
              <i className="legend-dot is-planned" /> Planejado
              <i className="legend-dot is-realized" /> Realizado
            </span>
          </div>
          <BarCompareChart points={monthSeries} />
        </section>

        <section className="panel">
          <h2>Distribuição por categoria</h2>
          <div className="resumo-donut-wrap">
            <DonutChart
              percent={100}
              label={`Total\n${formatCentsToBRL(comparison?.totalPlannedExpenseInCents || '0')}`}
              size={140}
              stroke={18}
            />
            <ul className="resumo-donut-legend">
              {donutSegments.map((item) => (
                <li key={item.categoryId}>
                  <CategoryIconBadge icon={item.icon} color={item.color} size={14} />
                  <span>{item.categoryName}</span>
                  <strong>{item.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Lançamentos recentes</h2>
            <Link href={lancamentosHref}>Ver todos</Link>
          </div>
          {recentEntries.length === 0 ? (
            <p className="muted-copy">Nenhum lançamento neste mês.</p>
          ) : (
            <ul className="resumo-recent-list">
              {recentEntries.map((entry) => (
                <li key={entry.id}>
                  <CategoryIconBadge
                    icon={entry.kind === 'income' ? 'wallet' : 'shopping-cart'}
                    color={entry.kind === 'income' ? '#059669' : '#E11D48'}
                    size={14}
                  />
                  <div>
                    <strong>{entry.description}</strong>
                    <span>
                      {entry.categoryName} · {entry.subcategoryName}
                    </span>
                  </div>
                  <div className="resumo-recent-value">
                    <MoneyDisplay
                      cents={BigInt(entry.amountInCents)}
                      tone={entry.kind === 'income' ? 'income' : 'expense'}
                    />
                    <small>{formatDisplayDate(entry.occurredOn)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="resumo-grid-2">
        <section className="panel">
          <div className="panel-heading">
            <h2>Resumo por categoria</h2>
            <Link href={planningHref}>Abrir planejamento</Link>
          </div>
          {expenseCategories.length === 0 ? (
            <p className="muted-copy">Sem categorias de gasto neste mês.</p>
          ) : (
            <div className="resumo-table">
              <div className="resumo-table-head">
                <span>Categoria</span>
                <span>Planejado</span>
                <span>Realizado</span>
                <span>Saldo</span>
                <span>% Utilizado</span>
              </div>
              {expenseCategories.slice(0, 8).map((item) => {
                const remaining = (
                  BigInt(item.plannedInCents || '0') - BigInt(item.realizedInCents || '0')
                ).toString();
                const pct = usagePercent(item.plannedInCents, item.realizedInCents);
                return (
                  <div key={item.categoryId} className="resumo-table-row">
                    <span className="resumo-table-cat">
                      <CategoryIconBadge icon={item.icon} color={item.color} size={14} />
                      {item.categoryName}
                    </span>
                    <span>{formatCentsToBRL(item.plannedInCents)}</span>
                    <span className="is-expense">{formatCentsToBRL(item.realizedInCents)}</span>
                    <span className={remaining.startsWith('-') ? 'is-expense' : 'is-income'}>
                      {formatCentsToBRL(remaining)}
                    </span>
                    <span className="planning-usage-cell">
                      <span className="planning-progress-track" aria-hidden>
                        <span
                          className={`planning-progress-fill${pct > 100 ? ' is-over' : ''}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </span>
                      <span className="planning-usage-pct">
                        {pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Destaques do mês</h2>
          <div className="resumo-highlights">
            <article className="resumo-highlight is-success">
              <TrendingUp size={18} />
              <div>
                <strong>Saldo positivo</strong>
                <p>
                  Previsão de {formatCentsToBRL(projected)} entre {period.startLabel} e{' '}
                  {period.endLabel}.
                </p>
              </div>
            </article>
            <article className="resumo-highlight is-info">
              <BarChart3 size={18} />
              <div>
                <strong>Maior gasto</strong>
                <p>
                  {donutSegments[0]
                    ? `${donutSegments[0].categoryName} representa ${donutSegments[0].pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% dos gastos.`
                    : 'Ainda não há distribuição de gastos.'}
                </p>
              </div>
            </article>
            <article className="resumo-highlight is-warning">
              <Target size={18} />
              <div>
                <strong>Orçamento utilizado</strong>
                <p>
                  Você já usou {budgetUsed.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do
                  planejado para gastos.
                </p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
