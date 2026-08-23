import { formatCentsToBRL } from '@pp-planning/contracts';
import { BarChart3, CalendarDays, ShoppingCart, Wallet } from 'lucide-react';
import { formatMonthPeriod, formatSharePercent, usagePercent } from './planning-metrics';
import type { PlanningTab } from '@/lib/planning-period';

export { formatMonthPeriod, formatSharePercent } from './planning-metrics';

type PlanningSummaryCardsProps = {
  tab: PlanningTab;
  year: number;
  month: number;
  editMode?: boolean;
  incomePlannedInCents: string;
  expensePlannedInCents: string;
  projectedBalanceInCents: string;
  incomeRealizedInCents: string;
  expenseRealizedInCents: string;
};

export function PlanningSummaryCards({
  tab,
  year,
  month,
  editMode = false,
  incomePlannedInCents,
  expensePlannedInCents,
  projectedBalanceInCents,
  incomeRealizedInCents,
  expenseRealizedInCents: _expenseRealizedInCents,
}: PlanningSummaryCardsProps) {
  const period = formatMonthPeriod(year, month);
  const expenseShare = formatSharePercent(expensePlannedInCents, incomePlannedInCents);
  const balanceShare = formatSharePercent(projectedBalanceInCents, incomePlannedInCents);
  const incomeRealizedPct = usagePercent(incomePlannedInCents, incomeRealizedInCents);
  void _expenseRealizedInCents;

  const cards =
    editMode && tab === 'receitas'
      ? [
          {
            key: 'income-planned',
            tone: 'income' as const,
            icon: Wallet,
            label: 'Total receitas planejadas',
            value: formatCentsToBRL(incomePlannedInCents),
            hint: '100% do previsto',
          },
          {
            key: 'income-realized',
            tone: 'income' as const,
            icon: Wallet,
            label: 'Total receitas realizadas',
            value: formatCentsToBRL(incomeRealizedInCents),
            hint: `${incomeRealizedPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do previsto`,
          },
          {
            key: 'balance',
            tone: 'balance' as const,
            icon: BarChart3,
            label: 'Saldo previsto',
            value: formatCentsToBRL(projectedBalanceInCents),
            hint: `${balanceShare} do previsto`,
          },
          {
            key: 'period',
            tone: 'period' as const,
            icon: CalendarDays,
            label: 'Período',
            value: `${period.startLabel} até ${period.endLabel}`,
            hint: `${period.days} ${period.days === 1 ? 'dia' : 'dias'}`,
            compact: true,
          },
        ]
      : editMode && tab === 'gastos'
        ? [
            {
              key: 'income-planned',
              tone: 'income' as const,
              icon: Wallet,
              label: 'Receitas planejadas',
              value: formatCentsToBRL(incomePlannedInCents),
              hint: '100% do previsto',
            },
            {
              key: 'expense-planned',
              tone: 'expense' as const,
              icon: ShoppingCart,
              label: 'Gastos planejados',
              value: formatCentsToBRL(expensePlannedInCents),
              hint: `${expenseShare} do previsto`,
            },
            {
              key: 'balance',
              tone: 'balance' as const,
              icon: BarChart3,
              label: 'Saldo previsto',
              value: formatCentsToBRL(projectedBalanceInCents),
              hint: `${balanceShare} do previsto`,
            },
            {
              key: 'period',
              tone: 'period' as const,
              icon: CalendarDays,
              label: 'Período',
              value: `${period.startLabel} até ${period.endLabel}`,
              hint: `${period.days} ${period.days === 1 ? 'dia' : 'dias'}`,
              compact: true,
            },
          ]
        : [
            {
              key: 'income-planned',
              tone: 'income' as const,
              icon: Wallet,
              label: 'Receitas planejadas',
              value: formatCentsToBRL(incomePlannedInCents),
              hint: '100% do previsto',
            },
            {
              key: 'expense-planned',
              tone: 'expense' as const,
              icon: ShoppingCart,
              label: 'Gastos planejados',
              value: formatCentsToBRL(expensePlannedInCents),
              hint: `${expenseShare} do previsto`,
            },
            {
              key: 'balance',
              tone: 'balance' as const,
              icon: BarChart3,
              label: 'Saldo previsto',
              value: formatCentsToBRL(projectedBalanceInCents),
              hint: `${balanceShare} do previsto`,
            },
            {
              key: 'period',
              tone: 'period' as const,
              icon: CalendarDays,
              label: 'Período relativo',
              value: `${period.startLabel} até ${period.endLabel}`,
              hint: `${period.days} ${period.days === 1 ? 'dia' : 'dias'}`,
              compact: true,
            },
          ];

  return (
    <div className="stat-grid planning-summary-cards">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.key} className={`stat-card is-${card.tone}`}>
            <div className="stat-card-label">
              <span className={`planning-card-icon is-${card.tone}`} aria-hidden="true">
                <Icon size={16} />
              </span>
              {card.label}
            </div>
            <div
              className={`stat-card-value planning-card-value is-${card.tone}${
                card.compact ? ' is-compact' : ''
              }`}
            >
              {card.value}
            </div>
            <div className={`stat-card-hint is-${card.tone}`}>{card.hint}</div>
          </article>
        );
      })}
    </div>
  );
}
