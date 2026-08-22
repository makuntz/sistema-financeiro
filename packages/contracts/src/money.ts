import { z } from 'zod';

export const MoneyInCentsSchema = z
  .string()
  .regex(/^\d+$/, 'Valor deve conter apenas dígitos')
  .refine((v) => v.length <= 15, 'Valor excede o limite máximo (15 dígitos)');

export type MoneyInCents = z.infer<typeof MoneyInCentsSchema>;

export const SignedMoneyInCentsSchema = z
  .string()
  .regex(/^-?\d+$/, 'Valor deve conter apenas dígitos com sinal opcional')
  .refine((v) => v.replace('-', '').length <= 15, 'Valor excede o limite máximo (15 dígitos)');

export type SignedMoneyInCents = z.infer<typeof SignedMoneyInCentsSchema>;

export function parseCentsString(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Valor inválido para centavos: "${value}"`);
  }
  return BigInt(value);
}

export function formatCentsToBRL(cents: bigint | string): string {
  const value = typeof cents === 'string' ? BigInt(cents) : cents;
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const str = abs.toString().padStart(3, '0');
  const intPart = str.slice(0, -2);
  const decPart = str.slice(-2);

  const groups: string[] = [];
  for (let i = intPart.length; i > 0; i -= 3) {
    groups.unshift(intPart.slice(Math.max(0, i - 3), i));
  }

  const formatted = `R$ ${groups.join('.')},${decPart}`;
  return negative ? `- ${formatted}` : formatted;
}

export function parseBRLInputToCents(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Valor não pode ser vazio');
  }

  const cleaned = trimmed.replace(/^R\$\s*/, '').replace(/\s/g, '');

  if (!cleaned) {
    throw new Error('Valor não pode ser vazio');
  }

  if (cleaned.startsWith('-')) {
    throw new Error('Valor não pode ser negativo');
  }

  if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    return parseBRLInputToCents(cleaned.replace('.', ','));
  }

  const match = /^(\d{1,3}(?:\.\d{3})*)(?:,(\d+))?$/.exec(cleaned);
  if (!match) {
    const simpleMatch = /^(\d+)(?:,(\d+))?$/.exec(cleaned);
    if (!simpleMatch) {
      throw new Error(`Formato BRL inválido: "${input}"`);
    }
    if (simpleMatch[2] && simpleMatch[2].length > 2) {
      throw new Error('Valor não pode ter mais de 2 casas decimais');
    }
    const intPart = simpleMatch[1]!;
    const decPart = (simpleMatch[2] ?? '').padEnd(2, '0');
    return `${intPart}${decPart}`;
  }

  if (match[2] && match[2].length > 2) {
    throw new Error('Valor não pode ter mais de 2 casas decimais');
  }

  const intPart = match[1]!.replace(/\./g, '');
  const decPart = (match[2] ?? '').padEnd(2, '0');
  const result = `${intPart}${decPart}`.replace(/^0+(?=\d)/, '');
  return result || '0';
}
