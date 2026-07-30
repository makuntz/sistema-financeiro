import { describe, expect, it } from 'vitest';
import {
  addCentsStrings,
  buildPlanningHref,
  formatMonthTitle,
  getSaoPauloYearMonth,
  parsePlanningSearchParams,
  shiftMonth,
  subtractCentsStrings,
} from '../lib/planning-period';

describe('getSaoPauloYearMonth', () => {
  it('uses America/Sao_Paulo timezone', () => {
    const result = getSaoPauloYearMonth(new Date('2026-07-01T02:30:00.000Z'));
    expect(result.year).toBe(2026);
    expect(result.month).toBe(6);
  });
});

describe('shiftMonth', () => {
  it('moves forward across year boundary', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('moves backward across year boundary', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('formatMonthTitle', () => {
  it('formats Portuguese month title', () => {
    expect(formatMonthTitle(2026, 7)).toBe('Julho de 2026');
  });
});

describe('parsePlanningSearchParams', () => {
  it('defaults to current month and resumo tab', () => {
    const current = getSaoPauloYearMonth();
    const parsed = parsePlanningSearchParams(new URLSearchParams());
    expect(parsed.year).toBe(current.year);
    expect(parsed.month).toBe(current.month);
    expect(parsed.tab).toBe('resumo');
    expect(parsed.normalized).toBe(false);
  });

  it('parses valid params', () => {
    const parsed = parsePlanningSearchParams(
      new URLSearchParams({ ano: '2026', mes: '8', aba: 'gastos' }),
    );
    expect(parsed).toEqual({
      year: 2026,
      month: 8,
      tab: 'gastos',
      normalized: false,
    });
  });

  it('normalizes invalid month and tab', () => {
    const current = getSaoPauloYearMonth();
    const parsed = parsePlanningSearchParams(
      new URLSearchParams({ ano: '2026', mes: '13', aba: 'invalid' }),
    );
    expect(parsed.month).toBe(current.month);
    expect(parsed.tab).toBe('resumo');
    expect(parsed.normalized).toBe(true);
  });
});

describe('buildPlanningHref', () => {
  it('builds query string for planning route', () => {
    expect(buildPlanningHref(2026, 7, 'receitas')).toBe(
      '/planejamento?ano=2026&mes=7&aba=receitas',
    );
  });
});

describe('cents string math', () => {
  it('adds and subtracts cents as strings', () => {
    expect(addCentsStrings(['100', '250', '50'])).toBe('400');
    expect(subtractCentsStrings('500000', '200000')).toBe('300000');
  });
});
