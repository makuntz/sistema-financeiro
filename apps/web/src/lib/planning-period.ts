/**
 * Helpers for monthly planning URLs and São Paulo calendar month.
 */

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export type PlanningTab = 'resumo' | 'receitas' | 'gastos';

export function getSaoPauloYearMonth(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

export function formatMonthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function parsePlanningSearchParams(searchParams: URLSearchParams): {
  year: number;
  month: number;
  tab: PlanningTab;
  normalized: boolean;
} {
  const current = getSaoPauloYearMonth();
  const yearRaw = searchParams.get('ano');
  const monthRaw = searchParams.get('mes');
  const tabRaw = searchParams.get('aba');

  let year = yearRaw ? Number(yearRaw) : current.year;
  let month = monthRaw ? Number(monthRaw) : current.month;
  let normalized = false;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    year = current.year;
    normalized = true;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    month = current.month;
    normalized = true;
  }

  let tab: PlanningTab = 'resumo';
  if (tabRaw === 'receitas' || tabRaw === 'gastos' || tabRaw === 'resumo') {
    tab = tabRaw;
  } else if (tabRaw) {
    normalized = true;
  }

  return { year, month, tab, normalized };
}

export function buildPlanningHref(year: number, month: number, tab: PlanningTab): string {
  const params = new URLSearchParams({
    ano: String(year),
    mes: String(month),
    aba: tab,
  });
  return `/planejamento?${params.toString()}`;
}

export function addCentsStrings(values: string[]): string {
  let total = 0n;
  for (const value of values) {
    total += BigInt(value || '0');
  }
  return total.toString();
}

export function subtractCentsStrings(left: string, right: string): string {
  return (BigInt(left || '0') - BigInt(right || '0')).toString();
}
