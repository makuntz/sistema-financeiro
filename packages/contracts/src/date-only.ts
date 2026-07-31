import { z } from 'zod';

const DATE_ONLY_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export const DateOnlySchema = z
  .string()
  .regex(DATE_ONLY_REGEX, 'Data deve estar no formato YYYY-MM-DD');

export type DateOnly = z.infer<typeof DateOnlySchema>;

export function parseDateOnly(value: string): { year: number; month: number; day: number } {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`Formato de data inválido: "${value}". Use YYYY-MM-DD.`);
  }
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const maxDay = new Date(year, month, 0).getDate();
  if (day > maxDay) {
    throw new Error(`Dia inválido ${day} para ${year}-${monthStr}.`);
  }

  return { year, month, day };
}

export function formatDateOnly(year: number, month: number, day: number): DateOnly {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function deriveCompetenceFromDateOnly(dateOnly: string): {
  competenceYear: number;
  competenceMonth: number;
} {
  const { year, month } = parseDateOnly(dateOnly);
  return { competenceYear: year, competenceMonth: month };
}
