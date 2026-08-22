import { canonicalizeForMatching } from './normalize.js';
import { estimateTokenPositionsInLine, type NormalizedOcrElement, type NormalizedOcrLine } from './spatial.js';

export type DetectedColumnBand = {
  kind: 'total' | 'unitPrice' | 'quantity' | 'tax' | 'description' | 'code';
  label: string;
  centerX: number;
  minX: number;
  maxX: number;
};

export type ReceiptColumnLayout = {
  bands: DetectedColumnBand[];
  totalBand: DetectedColumnBand | null;
};

const COLUMN_MATCHERS: Array<{ kind: DetectedColumnBand['kind']; patterns: string[] }> = [
  { kind: 'total', patterns: ['TOTAL', 'VL TOTAL', 'VLR TOTAL', 'VALOR TOTAL'] },
  { kind: 'unitPrice', patterns: ['VL UNIT', 'VL.UNIT', 'VLR UNIT', 'V UNIT', 'PRECO UNIT'] },
  { kind: 'quantity', patterns: ['QTD', 'QTDE', 'QUANT'] },
  { kind: 'tax', patterns: ['ST', 'CST', 'TRIB'] },
  { kind: 'description', patterns: ['DESCRICAO', 'DESCRIÇÃO', 'DESC'] },
  { kind: 'code', patterns: ['COD', 'CODIGO', 'SQ'] },
];

function flattenRowElements(row: NormalizedOcrLine[]): NormalizedOcrElement[] {
  const elements: NormalizedOcrElement[] = [];
  for (const line of row) {
    if (line.elements.length > 0) {
      elements.push(...line.elements);
      continue;
    }
    elements.push({
      text: line.text,
      frame: line.frame,
      centerX: line.centerX,
      centerY: line.centerY,
    });
  }
  return elements.sort((a, b) => a.centerX - b.centerX || a.centerY - b.centerY);
}

function matchColumnKind(text: string): DetectedColumnBand['kind'] | null {
  const canonical = canonicalizeForMatching(text);
  if (!canonical) {
    return null;
  }

  for (const matcher of COLUMN_MATCHERS) {
    if (matcher.patterns.some((pattern) => canonical.includes(pattern))) {
      if (matcher.kind === 'total' && (canonical.includes('QTD') || canonical.includes('SUBTOTAL'))) {
        continue;
      }
      return matcher.kind;
    }
  }

  return null;
}

function buildBand(
  kind: DetectedColumnBand['kind'],
  label: string,
  centerX: number,
  minX: number,
  maxX: number,
): DetectedColumnBand {
  return { kind, label, centerX, minX, maxX };
}

export function detectColumnLayoutFromHeaderRow(
  headerRow: NormalizedOcrLine[] | null,
  pageWidth: number,
): ReceiptColumnLayout | null {
  if (!headerRow || headerRow.length === 0 || pageWidth <= 0) {
    return null;
  }

  const elements = flattenRowElements(headerRow);
  let detected = elements.flatMap((element) => {
    const kind = matchColumnKind(element.text);
    if (!kind) {
      return [];
    }
    return [{ kind, label: element.text.trim(), centerX: element.centerX }];
  });

  if (detected.length === 0 && headerRow.length === 1) {
    const headerLine = headerRow[0]!;
    detected = estimateTokenPositionsInLine(headerLine).flatMap((token) => {
      const kind = matchColumnKind(token.text);
      if (!kind) {
        return [];
      }
      return [{ kind, label: token.text.trim(), centerX: token.centerX }];
    });
  }

  if (detected.length === 0) {
    return null;
  }

  const uniqueByKind = new Map<DetectedColumnBand['kind'], { label: string; centerX: number }>();
  for (const entry of detected) {
    const current = uniqueByKind.get(entry.kind);
    if (!current || entry.centerX > current.centerX) {
      uniqueByKind.set(entry.kind, { label: entry.label, centerX: entry.centerX });
    }
  }

  const sorted = [...uniqueByKind.entries()].sort((a, b) => a[1].centerX - b[1].centerX);
  const bands: DetectedColumnBand[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const [kind, value] = sorted[index]!;
    const prev = sorted[index - 1]?.[1]?.centerX ?? 0;
    const next = sorted[index + 1]?.[1]?.centerX ?? pageWidth;
    const leftBoundary = index === 0 ? 0 : (prev + value.centerX) / 2;
    const rightBoundary = index === sorted.length - 1 ? pageWidth : (value.centerX + next) / 2;
    bands.push(buildBand(kind, value.label, value.centerX, leftBoundary, rightBoundary));
  }

  return {
    bands,
    totalBand: bands.find((band) => band.kind === 'total') ?? null,
  };
}

export function isWithinBand(centerX: number, band: DetectedColumnBand): boolean {
  return centerX >= band.minX && centerX <= band.maxX;
}
