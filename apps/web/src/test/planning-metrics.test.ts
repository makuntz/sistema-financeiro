import { describe, expect, it } from 'vitest';
import {
  computeDisplayDifference,
  differenceHint,
  getPlanningColumnLabels,
  toneForPlanned,
  toneForRealized,
  toneForRemaining,
  usagePercent,
} from '../features/planning/planning-metrics';

describe('planning-metrics', () => {
  it('returns expense column labels', () => {
    expect(getPlanningColumnLabels('expense')).toEqual({
      name: 'Categoria / Subcategoria',
      planned: 'Planejado',
      realized: 'Realizado',
      remaining: 'Disponível',
      utilized: 'Utilizado',
    });
  });

  it('returns income column labels', () => {
    expect(getPlanningColumnLabels('income')).toEqual({
      name: 'Fonte de receita',
      planned: 'Planejado',
      realized: 'Realizado',
      remaining: 'Diferença',
    });
  });

  it('computes expense remaining as planned minus realized', () => {
    expect(computeDisplayDifference('expense', '210000', '26000')).toBe('184000');
  });

  it('computes income difference as realized minus planned', () => {
    expect(computeDisplayDifference('income', '500000', '0')).toBe('-500000');
  });

  it('shows overflow hint for negative expense remaining', () => {
    expect(differenceHint('expense', '-15000')).toBe('Acima do planejado');
  });

  it('hides hint for positive remaining', () => {
    expect(differenceHint('expense', '15000')).toBeNull();
    expect(differenceHint('expense', '0')).toBeNull();
  });

  it('uses neutral planned tone and semantic remaining tones', () => {
    expect(toneForPlanned()).toBe('neutral');
    expect(toneForRealized()).toBe('emphasis');
    expect(toneForRemaining('100')).toBe('positive');
    expect(toneForRemaining('0')).toBe('muted');
    expect(toneForRemaining('-100')).toBe('negative');
  });

  it('caps usage percent math without exceeding display width source', () => {
    expect(usagePercent('10000', '12000')).toBe(120);
    expect(usagePercent('0', '100')).toBe(0);
  });
});
