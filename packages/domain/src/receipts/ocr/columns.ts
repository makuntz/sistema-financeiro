import { canonicalizeForMatching } from './normalize.js';
import type { DetectedTableHeader } from './header-detection.js';
import type { SpatialElement } from './visual-rows.js';
import { estimateTokenPositionsInLine, type NormalizedOcrLine } from './spatial.js';

export type DetectedColumnBand = {
  kind: 'total' | 'unitPrice' | 'quantity' | 'tax' | 'description' | 'code';
  label: string;
  centerX: number;
  minX: number;
  maxX: number;
  normalizedCenterX: number;
  normalizedMinX: number;
  normalizedMaxX: number;
};

export type ReceiptColumnLayout = {
  bands: DetectedColumnBand[];
  totalBand: DetectedColumnBand | null;
  unitPriceBand: DetectedColumnBand | null;
  quantityBand: DetectedColumnBand | null;
  confidence: 'header' | 'cluster' | 'low';
};

const COLUMN_MATCHERS: Array<{ kind: DetectedColumnBand['kind']; patterns: string[] }> = [
  { kind: 'total', patterns: ['TOTAL', 'VL TOTAL', 'VLR TOTAL', 'VALOR TOTAL'] },
  { kind: 'unitPrice', patterns: ['VL UNIT', 'VL.UNIT', 'VLR UNIT', 'V UNIT', 'PRECO UNIT'] },
  { kind: 'quantity', patterns: ['QTD', 'QTDE', 'QUANT'] },
  { kind: 'tax', patterns: ['ST', 'CST', 'TRIB'] },
  { kind: 'description', patterns: ['DESCRICAO', 'DESCRIÇÃO', 'DESC'] },
  { kind: 'code', patterns: ['COD', 'CODIGO', 'SQ'] },
];

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
  pageWidth: number,
): DetectedColumnBand {
  return {
    kind,
    label,
    centerX,
    minX,
    maxX,
    normalizedCenterX: pageWidth > 0 ? centerX / pageWidth : 0,
    normalizedMinX: pageWidth > 0 ? minX / pageWidth : 0,
    normalizedMaxX: pageWidth > 0 ? maxX / pageWidth : 1,
  };
}

function buildLayoutFromDetected(
  detected: Array<{ kind: DetectedColumnBand['kind']; label: string; centerX: number }>,
  pageWidth: number,
  confidence: ReceiptColumnLayout['confidence'],
): ReceiptColumnLayout | null {
  if (detected.length === 0 || pageWidth <= 0) {
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
    bands.push(buildBand(kind, value.label, value.centerX, leftBoundary, rightBoundary, pageWidth));
  }

  return {
    bands,
    totalBand: bands.find((band) => band.kind === 'total') ?? null,
    unitPriceBand: bands.find((band) => band.kind === 'unitPrice') ?? null,
    quantityBand: bands.find((band) => band.kind === 'quantity') ?? null,
    confidence,
  };
}

export function buildColumnLayoutFromHeader(
  header: DetectedTableHeader,
  pageWidth: number,
): ReceiptColumnLayout | null {
  const detected = header.elements.flatMap((element) => {
    const kind = matchColumnKind(element.text);
    if (!kind) {
      return [];
    }
    return [{ kind, label: element.text.trim(), centerX: element.centerX }];
  });

  return buildLayoutFromDetected(detected, pageWidth, 'header');
}

export function buildColumnLayoutFromClusterBand(input: {
  pageWidth: number;
  totalBand: { minX: number; maxX: number; centerX: number; normalizedMinX: number; normalizedMaxX: number };
  unitPriceBand?: { minX: number; maxX: number; centerX: number; normalizedMinX: number; normalizedMaxX: number } | null;
}): ReceiptColumnLayout {
  const bands: DetectedColumnBand[] = [
    buildBand(
      'total',
      'TOTAL (inferido)',
      input.totalBand.centerX,
      input.totalBand.minX,
      input.totalBand.maxX,
      input.pageWidth,
    ),
  ];

  if (input.unitPriceBand) {
    bands.unshift(
      buildBand(
        'unitPrice',
        'VL.UNIT (inferido)',
        input.unitPriceBand.centerX,
        input.unitPriceBand.minX,
        input.unitPriceBand.maxX,
        input.pageWidth,
      ),
    );
  }

  bands.sort((a, b) => a.centerX - b.centerX);

  return {
    bands,
    totalBand: bands.find((band) => band.kind === 'total') ?? null,
    unitPriceBand: bands.find((band) => band.kind === 'unitPrice') ?? null,
    quantityBand: null,
    confidence: 'cluster',
  };
}

export function detectColumnLayoutFromHeaderRow(
  headerRow: NormalizedOcrLine[] | null,
  pageWidth: number,
): ReceiptColumnLayout | null {
  if (!headerRow || headerRow.length === 0 || pageWidth <= 0) {
    return null;
  }

  const elements = headerRow.flatMap((line) =>
    line.elements.length > 0
      ? line.elements.map((element) => ({ text: element.text, centerX: element.centerX }))
      : [{ text: line.text, centerX: line.centerX }],
  );

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

  return buildLayoutFromDetected(detected, pageWidth, 'header');
}

export function isWithinBand(centerX: number, band: DetectedColumnBand): boolean {
  return centerX >= band.minX && centerX <= band.maxX;
}

export function isWithinNormalizedBand(normalizedCenterX: number, band: DetectedColumnBand): boolean {
  return (
    normalizedCenterX >= band.normalizedMinX && normalizedCenterX <= band.normalizedMaxX
  );
}

export function pickElementsInBand(elements: SpatialElement[], band: DetectedColumnBand): SpatialElement[] {
  return elements.filter((element) => isWithinBand(element.centerX, band));
}
