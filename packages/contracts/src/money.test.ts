import { describe, expect, it } from 'vitest';
import {
  MoneyInCentsSchema,
  SignedMoneyInCentsSchema,
  parseCentsString,
  formatCentsToBRL,
  parseBRLInputToCents,
} from './money.js';

describe('MoneyInCentsSchema', () => {
  it('accepts digit strings', () => {
    expect(MoneyInCentsSchema.parse('0')).toBe('0');
    expect(MoneyInCentsSchema.parse('12345')).toBe('12345');
    expect(MoneyInCentsSchema.parse('178609')).toBe('178609');
  });

  it('rejects non-digit strings', () => {
    expect(() => MoneyInCentsSchema.parse('')).toThrow();
    expect(() => MoneyInCentsSchema.parse('12.34')).toThrow();
    expect(() => MoneyInCentsSchema.parse('-100')).toThrow();
    expect(() => MoneyInCentsSchema.parse('abc')).toThrow();
  });

  it('rejects values exceeding 15 digits', () => {
    expect(() => MoneyInCentsSchema.parse('1234567890123456')).toThrow();
  });

  it('accepts up to 15 digits', () => {
    expect(MoneyInCentsSchema.parse('123456789012345')).toBe('123456789012345');
  });
});

describe('parseCentsString', () => {
  it('converts digit string to bigint', () => {
    expect(parseCentsString('178609')).toBe(178609n);
    expect(parseCentsString('0')).toBe(0n);
  });

  it('throws for invalid strings', () => {
    expect(() => parseCentsString('abc')).toThrow();
    expect(() => parseCentsString('12.34')).toThrow();
  });
});

describe('formatCentsToBRL', () => {
  it('formats bigint cents to BRL', () => {
    expect(formatCentsToBRL(178609n)).toBe('R$ 1.786,09');
    expect(formatCentsToBRL(0n)).toBe('R$ 0,00');
    expect(formatCentsToBRL(99n)).toBe('R$ 0,99');
    expect(formatCentsToBRL(100n)).toBe('R$ 1,00');
    expect(formatCentsToBRL(1000000n)).toBe('R$ 10.000,00');
  });

  it('formats string cents to BRL', () => {
    expect(formatCentsToBRL('178609')).toBe('R$ 1.786,09');
  });

  it('handles negative values', () => {
    expect(formatCentsToBRL(-500n)).toBe('- R$ 5,00');
  });
});

describe('SignedMoneyInCentsSchema', () => {
  it('accepts non-negative digit strings', () => {
    expect(SignedMoneyInCentsSchema.parse('0')).toBe('0');
    expect(SignedMoneyInCentsSchema.parse('12345')).toBe('12345');
  });

  it('accepts negative digit strings', () => {
    expect(SignedMoneyInCentsSchema.parse('-100')).toBe('-100');
    expect(SignedMoneyInCentsSchema.parse('-999999')).toBe('-999999');
  });

  it('rejects non-digit characters', () => {
    expect(() => SignedMoneyInCentsSchema.parse('abc')).toThrow();
    expect(() => SignedMoneyInCentsSchema.parse('12.34')).toThrow();
    expect(() => SignedMoneyInCentsSchema.parse('')).toThrow();
  });

  it('rejects values exceeding 15 digits', () => {
    expect(() => SignedMoneyInCentsSchema.parse('-1234567890123456')).toThrow();
  });
});

describe('parseBRLInputToCents', () => {
  it('parses formatted BRL values to cent strings', () => {
    expect(parseBRLInputToCents('1.786,09')).toBe('178609');
    expect(parseBRLInputToCents('R$ 1.786,09')).toBe('178609');
    expect(parseBRLInputToCents('0,99')).toBe('99');
    expect(parseBRLInputToCents('0,01')).toBe('1');
    expect(parseBRLInputToCents('1,00')).toBe('100');
    expect(parseBRLInputToCents('10.000,00')).toBe('1000000');
    expect(parseBRLInputToCents('1000000,99')).toBe('100000099');
  });

  it('parses zero', () => {
    expect(parseBRLInputToCents('0')).toBe('0');
  });

  it('handles values without decimal part', () => {
    expect(parseBRLInputToCents('1.786')).toBe('178600');
    expect(parseBRLInputToCents('100')).toBe('10000');
  });

  it('handles single decimal digit', () => {
    expect(parseBRLInputToCents('1,5')).toBe('150');
  });

  it('handles simple number format', () => {
    expect(parseBRLInputToCents('1500')).toBe('150000');
    expect(parseBRLInputToCents('1500,50')).toBe('150050');
    expect(parseBRLInputToCents('291.38')).toBe('29138');
  });

  it('throws for empty input', () => {
    expect(() => parseBRLInputToCents('')).toThrow('vazio');
    expect(() => parseBRLInputToCents('  ')).toThrow('vazio');
    expect(() => parseBRLInputToCents('R$ ')).toThrow('vazio');
  });

  it('throws for negative values', () => {
    expect(() => parseBRLInputToCents('-100')).toThrow('negativo');
    expect(() => parseBRLInputToCents('-1,50')).toThrow('negativo');
  });

  it('throws for more than 2 decimal places', () => {
    expect(() => parseBRLInputToCents('1,123')).toThrow('2 casas decimais');
    expect(() => parseBRLInputToCents('1.786,099')).toThrow('2 casas decimais');
  });

  it('throws for invalid format', () => {
    expect(() => parseBRLInputToCents('abc')).toThrow();
    expect(() => parseBRLInputToCents('12.34.56')).toThrow();
  });
});
