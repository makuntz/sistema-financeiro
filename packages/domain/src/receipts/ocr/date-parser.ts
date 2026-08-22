import { canonicalizeForMatching } from './normalize.js';

const DATE_PATTERNS = [
  /^(\d{2})[/.-](\d{2})[/.-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/,
  /^(\d{4})-(\d{2})-(\d{2})$/,
  /^(\d{2})[/.-](\d{2})[/.-](\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/,
];

const POSITIVE_DATE_ANCHORS = ['DATA', 'EMISSAO', 'EMITIDA', 'EMISSÃO', 'COMPRA', 'DATA/HORA'];
const NEGATIVE_DATE_ANCHORS = ['VALIDADE', 'PROMOCAO', 'PROMOÇÃO', 'VENCIMENTO'];

export type ParsedPurchaseDate = {
  value: string;
  score: number;
  sourceText: string;
};

function toDateOnly(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseDateToken(text: string): string | null {
  const trimmed = text.trim();
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (!match) {
      continue;
    }
    if (match[3]!.length === 4) {
      return toDateOnly(Number(match[3]), Number(match[2]), Number(match[1]));
    }
    if (match[1]!.length === 4) {
      return toDateOnly(Number(match[1]), Number(match[2]), Number(match[3]));
    }
    const yy = Number(match[3]!);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return toDateOnly(year, Number(match[2]), Number(match[1]));
  }
  return null;
}

function scoreDateContext(context: string): number {
  const canonical = canonicalizeForMatching(context);
  let score = 1;
  for (const anchor of POSITIVE_DATE_ANCHORS) {
    if (canonical.includes(anchor)) {
      score += 3;
    }
  }
  for (const anchor of NEGATIVE_DATE_ANCHORS) {
    if (canonical.includes(anchor)) {
      score -= 4;
    }
  }
  return score;
}

export function extractPurchaseDate(lines: string[]): ParsedPurchaseDate | null {
  const candidates: ParsedPurchaseDate[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(' ');
    const tokens = line.split(/\s+/);
    for (const token of tokens) {
      const parsed = parseDateToken(token);
      if (parsed) {
        candidates.push({
          value: parsed,
          score: scoreDateContext(context),
          sourceText: line,
        });
      }
    }

    const wholeLine = parseDateToken(line);
    if (wholeLine) {
      candidates.push({
        value: wholeLine,
        score: scoreDateContext(context) + 1,
        sourceText: line,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
  return candidates[0] ?? null;
}
