import { ITEM_HEADER_ANCHORS, PAYMENT_ANCHORS, TOTAL_POSITIVE_ANCHORS } from './anchors.js';
import { canonicalizeForMatching } from './normalize.js';
import { canonicalIncludesAny, extractMoneyCandidates } from './money-parser.js';
import type { SpatialElement, VisualRow } from './visual-rows.js';
import { findRowsNearY } from './visual-rows.js';

const HEADER_LABELS: Array<{ kind: string; patterns: string[]; weight: number }> = [
  { kind: 'code', patterns: ['SQ', 'COD', 'CODIGO'], weight: 2 },
  { kind: 'description', patterns: ['DESCRICAO', 'DESCRIÇÃO', 'DESC'], weight: 3 },
  { kind: 'quantity', patterns: ['QTD', 'QTDE', 'QUANT'], weight: 3 },
  { kind: 'unitPrice', patterns: ['VL UNIT', 'VL.UNIT', 'VLR UNIT', 'V UNIT', 'PRECO UNIT'], weight: 3 },
  { kind: 'tax', patterns: ['ST', 'CST', 'TRIB'], weight: 2 },
  { kind: 'total', patterns: ['TOTAL', 'VL TOTAL', 'VLR TOTAL'], weight: 4 },
];

export type DetectedTableHeader = {
  rows: VisualRow[];
  elements: SpatialElement[];
  score: number;
  bottomY: number;
  normalizedBottomY: number;
  detectedKinds: string[];
};

function rowHasFooterOrPaymentAnchor(row: VisualRow): boolean {
  if (canonicalIncludesAny(row.text, TOTAL_POSITIVE_ANCHORS)) {
    return true;
  }
  if (canonicalIncludesAny(row.text, PAYMENT_ANCHORS)) {
    return true;
  }
  const canonical = canonicalizeForMatching(row.text);
  if (canonical.includes('QTD') && canonical.includes('ITENS')) {
    return true;
  }
  return false;
}

function rowHasItemSequence(row: VisualRow): boolean {
  return /^\d{1,2}\s+(?:\d{8,14}\s+)?[A-ZÀ-ÿ]/i.test(row.text);
}

function rowHasTrailingMoney(row: VisualRow): boolean {
  if (extractMoneyCandidates(row.text).length > 0) {
    return true;
  }
  const rightElements = row.elements.filter((element) => element.normalizedCenterX > 0.55);
  return rightElements.some((element) => extractMoneyCandidates(element.text).length > 0);
}

function scoreHeaderElement(text: string): { score: number; kinds: string[] } {
  const canonical = canonicalizeForMatching(text);
  if (!canonical) {
    return { score: 0, kinds: [] };
  }

  let score = 0;
  const kinds: string[] = [];

  for (const label of HEADER_LABELS) {
    if (label.patterns.some((pattern) => canonical.includes(pattern))) {
      if (label.kind === 'total' && (canonical.includes('QTD') || canonical.includes('SUBTOTAL'))) {
        continue;
      }
      score += label.weight;
      kinds.push(label.kind);
    }
  }

  return { score, kinds };
}

function scoreHeaderRow(row: VisualRow): { score: number; kinds: string[] } {
  if (rowHasFooterOrPaymentAnchor(row) || rowHasItemSequence(row)) {
    return { score: 0, kinds: [] };
  }
  if (rowHasTrailingMoney(row)) {
    return { score: 0, kinds: [] };
  }

  let score = 0;
  const kinds = new Set<string>();

  for (const element of row.elements) {
    const elementScore = scoreHeaderElement(element.text);
    score += elementScore.score;
    for (const kind of elementScore.kinds) {
      kinds.add(kind);
    }
  }

  if (kinds.has('description') && kinds.has('total')) {
    score += 4;
  }
  if (kinds.has('quantity') && kinds.has('unitPrice')) {
    score += 3;
  }
  if (kinds.size === 1 && kinds.has('description')) {
    score += 2;
  }

  return { score, kinds: [...kinds] };
}

export function isStrongTableHeaderRow(row: VisualRow): boolean {
  const { score, kinds } = scoreHeaderRow(row);
  return score >= 6 || (kinds.includes('description') && kinds.includes('total'));
}

function findFooterItemCountRowIndex(rows: VisualRow[]): number {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const canonical = canonicalizeForMatching(row.text);
    if (
      canonicalIncludesAny(row.text, [
        'QTD TOTAL DE ITENS',
        'QTDE TOTAL DE ITENS',
        'QTD. TOTAL DE ITENS',
      ]) ||
      (canonical.includes('QTD') && canonical.includes('TOTAL') && canonical.includes('ITENS'))
    ) {
      return index;
    }
  }
  return rows.length;
}

function resolveHeaderSearchMaxY(rows: VisualRow[], rowToleranceY: number): number {
  const sortedByY = [...rows].sort((a, b) => a.centerY - b.centerY);
  if (sortedByY.length === 0) {
    return Infinity;
  }

  const footerIndex = findFooterItemCountRowIndex(sortedByY);
  const footerY = sortedByY[Math.min(footerIndex, sortedByY.length - 1)]?.centerY ?? Infinity;

  let firstSequenceY = Infinity;
  for (const row of sortedByY) {
    if (/^\d{1,3}\s+(?:\d{8,14}\s+)?[A-ZÀ-ÿ]/i.test(row.text.trim())) {
      firstSequenceY = row.centerY;
      break;
    }
  }

  if (firstSequenceY < Infinity) {
    return firstSequenceY + rowToleranceY * 1.5;
  }

  const zoneByCount =
    sortedByY[Math.min(Math.max(3, Math.ceil(sortedByY.length * 0.45)) - 1, sortedByY.length - 1)]
      ?.centerY ?? Infinity;

  const candidates = [footerY, zoneByCount].filter((value) => Number.isFinite(value));
  const limitY = Math.min(...candidates);
  return limitY + rowToleranceY * 2;
}

export function detectItemTableHeader(
  rows: VisualRow[],
  rowToleranceY: number,
): DetectedTableHeader | null {
  let best: DetectedTableHeader | null = null;
  const headerZoneMaxY = resolveHeaderSearchMaxY(rows, rowToleranceY);

  for (const row of rows) {
    if (row.centerY > headerZoneMaxY) {
      continue;
    }
    if (rowHasFooterOrPaymentAnchor(row) || rowHasItemSequence(row) || rowHasTrailingMoney(row)) {
      continue;
    }

    const { score } = scoreHeaderRow(row);
    if (score < 3) {
      continue;
    }

    const clusterRows = findRowsNearY(rows, row.centerY, rowToleranceY).filter((candidate) => {
      if (candidate.centerY > headerZoneMaxY) {
        return false;
      }
      if (rowHasFooterOrPaymentAnchor(candidate) || rowHasItemSequence(candidate)) {
        return false;
      }
      if (rowHasTrailingMoney(candidate)) {
        return false;
      }
      const candidateScore = scoreHeaderRow(candidate);
      return candidateScore.score >= 2 || isStrongTableHeaderRow(candidate);
    });

    const elements = clusterRows
      .flatMap((clusterRow) => clusterRow.elements)
      .sort((a, b) => a.centerX - b.centerX);

    const clusterScore =
      score + clusterRows.reduce((sum, clusterRow) => sum + scoreHeaderRow(clusterRow).score, 0);
    const detectedKinds = [
      ...new Set(clusterRows.flatMap((clusterRow) => scoreHeaderRow(clusterRow).kinds)),
    ];

    const bottomY = Math.max(...clusterRows.map((clusterRow) => clusterRow.centerY));
    const normalizedBottomY = Math.max(
      ...elements.map((element) => element.normalizedBottom),
    );

    const candidate: DetectedTableHeader = {
      rows: clusterRows,
      elements,
      score: clusterScore,
      bottomY,
      normalizedBottomY,
      detectedKinds,
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}

export function rowIsWithinHeaderBand(row: VisualRow, header: DetectedTableHeader, slackY: number): boolean {
  return row.centerY <= header.bottomY + slackY && isStrongTableHeaderRow(row);
}

export function rowLooksLikeHeader(row: VisualRow): boolean {
  if (rowHasFooterOrPaymentAnchor(row) || rowHasItemSequence(row)) {
    return false;
  }
  if (isStrongTableHeaderRow(row)) {
    return true;
  }
  const text = canonicalizeForMatching(row.text);
  if (!text) {
    return false;
  }
  return (
    canonicalIncludesAny(row.text, [...ITEM_HEADER_ANCHORS, 'SQ CODIGO', 'SQ.CODIGO']) &&
    !rowHasTrailingMoney(row)
  );
}
