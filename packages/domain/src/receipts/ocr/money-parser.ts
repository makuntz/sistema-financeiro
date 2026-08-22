import { canonicalizeForMatching, normalizeMoneySymbols, normalizeOcrText } from './normalize.js';

const CNPJ_PATTERN = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;
const CPF_PATTERN = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const EAN_PATTERN = /^\d{8,14}$/;
const DATE_LIKE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;
const TIME_SUFFIX = /\d{1,2}:\d{2}(?::\d{2})?/;
const MONEY_TOKEN_PATTERN = /(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}(?!\d)|\d+\.\d{2}(?!\d)/g;

/** NFC-e ST column tokens (T10, T15, etc.) must not merge with adjacent prices. */
export function stripTaxStatusTokens(text: string): string {
  return normalizeOcrText(text)
    .replace(/\bT\d{1,2}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBrazilianMoneyToCents(input: string): string | null {
  const normalized = normalizeMoneySymbols(stripTaxStatusTokens(input));
  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/\s+/g, '');
  if (!compact) {
    return null;
  }

  if (CNPJ_PATTERN.test(compact) || CPF_PATTERN.test(compact) || EAN_PATTERN.test(compact)) {
    return null;
  }

  if (DATE_LIKE.test(compact)) {
    return null;
  }

  if (/,\d{3,}/.test(compact)) {
    return null;
  }

  const brMatch = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(compact);
  if (brMatch) {
    const intPart = brMatch[1]!.replace(/\./g, '');
    const decPart = (brMatch[2] ?? '00').padEnd(2, '0').slice(0, 2);
    if (decPart.length !== 2) {
      return null;
    }
    const cents = `${intPart}${decPart}`.replace(/^0+(?=\d)/, '');
    return cents || '0';
  }

  const usMatch = /^(\d+)(?:\.(\d{2}))?$/.exec(compact);
  if (usMatch) {
    const intPart = usMatch[1]!;
    const decPart = (usMatch[2] ?? '00').padEnd(2, '0').slice(0, 2);
    const cents = `${intPart}${decPart}`.replace(/^0+(?=\d)/, '');
    return cents || '0';
  }

  return null;
}

export function extractMoneyCandidates(text: string): string[] {
  const stripped = stripTaxStatusTokens(text);
  const normalized = normalizeMoneySymbols(stripped);
  const matches = normalized.match(MONEY_TOKEN_PATTERN) ?? [];
  const centsValues: string[] = [];

  for (const match of matches) {
    const cleaned = match.replace(/\s+/g, ' ').trim();
    if (!cleaned || TIME_SUFFIX.test(cleaned)) {
      continue;
    }
    const cents = parseBrazilianMoneyToCents(cleaned);
    if (cents != null && cents !== '0') {
      centsValues.push(cents);
    }
  }

  return centsValues;
}

export function pickBestLineTotalCents(candidates: string[]): string | null {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  const numeric = candidates.map((value) => BigInt(value));
  const min = numeric.reduce((acc, value) => (value < acc ? value : acc));
  const max = numeric.reduce((acc, value) => (value > acc ? value : acc));

  // T10 + 7,99 → 107,99 in the same token blob: prefer the smaller plausible value.
  if (max > min * 5n && min <= 50000n) {
    const minText = min.toString();
    if (candidates.includes(minText)) {
      return minText;
    }
  }

  return candidates[candidates.length - 1]!;
}

export type MoneyAtPosition = {
  cents: string;
  centerX: number;
  text: string;
};

export function extractMoneyAtPositions(
  row: Array<{ text: string; centerX: number }>,
): MoneyAtPosition[] {
  const values: MoneyAtPosition[] = [];

  for (const element of row) {
    const stripped = stripTaxStatusTokens(element.text);
    for (const cents of extractMoneyCandidates(stripped)) {
      values.push({ cents, centerX: element.centerX, text: element.text });
    }
  }

  return values;
}

export function pickLineTotalFromPositions(
  values: MoneyAtPosition[],
  options?: { totalBand?: { minX: number; maxX: number } | null },
): string | null {
  if (values.length === 0) {
    return null;
  }

  const inTotalBand =
    options?.totalBand != null
      ? values.filter(
          (value) =>
            value.centerX >= options.totalBand!.minX && value.centerX <= options.totalBand!.maxX,
        )
      : [];

  const tryPick = (pool: MoneyAtPosition[]): string | null => {
    if (pool.length === 0) {
      return null;
    }
    pool.sort((a, b) => a.centerX - b.centerX || BigInt(a.cents) > BigInt(b.cents) ? 1 : -1);
    const rightmostX = pool[pool.length - 1]!.centerX;
    const rightmostGroup = pool.filter((value) => Math.abs(value.centerX - rightmostX) <= 12);
    return pickBestLineTotalCents(rightmostGroup.map((value) => value.cents));
  };

  const fromBand = tryPick(inTotalBand);
  if (fromBand) {
    return fromBand;
  }

  return tryPick(values);
}

export function looksLikeMoneyText(text: string): boolean {
  return parseBrazilianMoneyToCents(text) != null;
}

export function formatCentsDifferenceMessage(differenceInCents: bigint): string {
  const negative = differenceInCents < 0n;
  const abs = negative ? -differenceInCents : differenceInCents;
  const str = abs.toString().padStart(3, '0');
  const intPart = str.slice(0, -2);
  const decPart = str.slice(-2);
  const formatted = `R$ ${intPart},${decPart}`;
  return negative ? `- ${formatted}` : formatted;
}

export function canonicalIncludesAny(text: string, needles: readonly string[]): boolean {
  const canonical = canonicalizeForMatching(text);
  return needles.some((needle) => canonical.includes(needle));
}
