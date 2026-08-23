import { subtractCentsStrings } from '@/lib/planning-period';

export type PlanningMetricKind = 'expense' | 'income';

export type PlanningColumnLabels = {
  name: string;
  planned: string;
  realized: string;
  remaining: string;
};

export function formatMonthPeriod(year: number, month: number) {
  const days = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startLabel: `01/${pad(month)}/${year}`,
    endLabel: `${pad(days)}/${pad(month)}/${year}`,
    days,
  };
}

export function formatSharePercent(partInCents: string, totalInCents: string): string {
  const total = BigInt(totalInCents || '0');
  if (total <= 0n) return '0%';
  const part = BigInt(partInCents || '0');
  const pct = Number((part * 1000n) / total) / 10;
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function getPlanningColumnLabels(kind: PlanningMetricKind): PlanningColumnLabels {
  if (kind === 'income') {
    return {
      name: 'Fonte de receita',
      planned: 'Planejado',
      realized: 'Realizado',
      remaining: 'Diferença',
    };
  }
  return {
    name: 'Subcategoria',
    planned: 'Planejado',
    realized: 'Realizado',
    remaining: 'Disponível',
  };
}

/** Same semantics as reports: expense = planned − realized; income = realized − planned. */
export function computeDisplayDifference(
  kind: PlanningMetricKind,
  plannedInCents: string,
  realizedInCents: string,
): string {
  if (kind === 'expense') {
    return subtractCentsStrings(plannedInCents || '0', realizedInCents || '0');
  }
  return subtractCentsStrings(realizedInCents || '0', plannedInCents || '0');
}

export function differenceHint(kind: PlanningMetricKind, differenceInCents: string): string | null {
  const diff = BigInt(differenceInCents || '0');
  if (diff >= 0n) return null;
  if (kind === 'expense') return 'Acima do planejado';
  return 'Abaixo do previsto';
}

export type MoneySemanticTone = 'neutral' | 'muted' | 'positive' | 'negative' | 'emphasis';

export function toneForPlanned(): MoneySemanticTone {
  return 'neutral';
}

export function toneForRealized(): MoneySemanticTone {
  return 'emphasis';
}

export function toneForRemaining(differenceInCents: string): MoneySemanticTone {
  const diff = BigInt(differenceInCents || '0');
  if (diff === 0n) return 'muted';
  return diff > 0n ? 'positive' : 'negative';
}

export function usagePercent(plannedInCents: string, realizedInCents: string): number {
  const planned = BigInt(plannedInCents || '0');
  if (planned <= 0n) return 0;
  const realized = BigInt(realizedInCents || '0');
  return Number((realized * 10000n) / planned) / 100;
}
