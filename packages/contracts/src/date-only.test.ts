import { describe, it, expect } from 'vitest';
import {
  DateOnlySchema,
  parseDateOnly,
  formatDateOnly,
  deriveCompetenceFromDateOnly,
} from './date-only.js';

describe('DateOnlySchema', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(DateOnlySchema.parse('2026-07-30')).toBe('2026-07-30');
    expect(DateOnlySchema.parse('2000-01-01')).toBe('2000-01-01');
    expect(DateOnlySchema.parse('2099-12-31')).toBe('2099-12-31');
  });

  it('rejects invalid formats', () => {
    expect(() => DateOnlySchema.parse('30/07/2026')).toThrow();
    expect(() => DateOnlySchema.parse('2026-7-30')).toThrow();
    expect(() => DateOnlySchema.parse('2026-00-01')).toThrow();
    expect(() => DateOnlySchema.parse('2026-13-01')).toThrow();
    expect(() => DateOnlySchema.parse('2026-07-32')).toThrow();
    expect(() => DateOnlySchema.parse('')).toThrow();
  });
});

describe('parseDateOnly', () => {
  it('parses valid date', () => {
    expect(parseDateOnly('2026-07-30')).toEqual({ year: 2026, month: 7, day: 30 });
  });

  it('throws on invalid day for month', () => {
    expect(() => parseDateOnly('2026-02-30')).toThrow();
  });

  it('handles leap year correctly', () => {
    expect(parseDateOnly('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(() => parseDateOnly('2023-02-29')).toThrow();
  });

  it('does NOT shift timezone — no Date object involved', () => {
    const result = parseDateOnly('2026-01-01');
    expect(result).toEqual({ year: 2026, month: 1, day: 1 });
  });
});

describe('formatDateOnly', () => {
  it('formats with zero padding', () => {
    expect(formatDateOnly(2026, 1, 5)).toBe('2026-01-05');
    expect(formatDateOnly(2026, 12, 31)).toBe('2026-12-31');
  });
});

describe('deriveCompetenceFromDateOnly', () => {
  it('derives competence year/month from date string', () => {
    expect(deriveCompetenceFromDateOnly('2026-07-30')).toEqual({
      competenceYear: 2026,
      competenceMonth: 7,
    });
    expect(deriveCompetenceFromDateOnly('2026-01-01')).toEqual({
      competenceYear: 2026,
      competenceMonth: 1,
    });
  });

  it('timezone-safe: 2026-01-01 stays January even at UTC edge', () => {
    const result = deriveCompetenceFromDateOnly('2026-01-01');
    expect(result.competenceMonth).toBe(1);
    expect(result.competenceYear).toBe(2026);
  });
});
