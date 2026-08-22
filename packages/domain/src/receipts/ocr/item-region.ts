import {
  ITEM_ROW_EAN_START_PATTERN,
  ITEM_ROW_START_PATTERN,
  QTY_TIMES_UNIT_PATTERN,
  WEIGHTED_LINE_PATTERN,
} from './anchors.js';
import { canonicalizeForMatching } from './normalize.js';
import { canonicalIncludesAny } from './money-parser.js';
import type { DetectedTableHeader } from './header-detection.js';
import { rowLooksLikeHeader } from './header-detection.js';
import type { VisualRow, VisualRowsContext } from './visual-rows.js';

export type ItemRegionBounds = {
  startY: number;
  endY: number;
  declaredItemCount: number | null;
  footerStartRowIndex: number;
};

export function extractDeclaredItemCount(rows: VisualRow[]): number | null {
  for (const row of rows) {
    const canonical = canonicalizeForMatching(row.text);
    if (!canonical.includes('QTD') || !canonical.includes('TOTAL') || !canonical.includes('ITENS')) {
      continue;
    }
    const match = /(\d{1,4})\s*$/.exec(row.text.replace(/\s+/g, ' ').trim());
    if (match) {
      const value = Number.parseInt(match[1]!, 10);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
    for (const element of row.elements) {
      const digits = element.text.replace(/\D/g, '');
      if (/^\d{1,4}$/.test(digits) && element.normalizedCenterX > 0.45) {
        const value = Number.parseInt(digits, 10);
        if (value > 0 && value <= 999) {
          return value;
        }
      }
    }
  }
  return null;
}

function rowMatchesFooterItemCountAnchor(row: VisualRow): boolean {
  const canonical = canonicalizeForMatching(row.text);
  return (
    canonicalIncludesAny(row.text, [
      'QTD TOTAL DE ITENS',
      'QTDE TOTAL DE ITENS',
      'QTD. TOTAL DE ITENS',
    ]) ||
    (canonical.includes('QTD') && canonical.includes('TOTAL') && canonical.includes('ITENS'))
  );
}

export function findFooterItemCountRowIndex(rows: VisualRow[]): number {
  for (let index = 0; index < rows.length; index += 1) {
    if (rowMatchesFooterItemCountAnchor(rows[index]!)) {
      return index;
    }
  }
  return rows.length;
}

export function looksLikeItemProductRow(row: VisualRow): boolean {
  const text = row.text.trim();
  if (!text || rowLooksLikeHeader(row)) {
    return false;
  }
  if (ITEM_ROW_START_PATTERN.test(text) || ITEM_ROW_EAN_START_PATTERN.test(text)) {
    return true;
  }
  if (WEIGHTED_LINE_PATTERN.test(text) || QTY_TIMES_UNIT_PATTERN.test(text)) {
    return true;
  }
  if (extractItemSequenceNumber(row) != null) {
    return true;
  }
  return false;
}

export function findItemSequenceAnchorRows(rows: VisualRow[]): VisualRow[] {
  return rows.filter((row) => extractItemSequenceNumber(row) != null);
}

export function detectItemRegionBounds(
  visual: VisualRowsContext,
  header: DetectedTableHeader | null,
): ItemRegionBounds {
  const footerStartRowIndex = findFooterItemCountRowIndex(visual.rows);
  const footerRow = visual.rows[footerStartRowIndex];
  const footerY = footerRow?.centerY ?? visual.pageHeight;

  const sequenceRows = findItemSequenceAnchorRows(visual.rows);
  const productRows = visual.rows.filter((row) => looksLikeItemProductRow(row));
  const anchorRows = sequenceRows.length > 0 ? sequenceRows : productRows;

  const firstSequenceY =
    anchorRows.length > 0
      ? Math.min(...anchorRows.map((row) => row.centerY))
      : Number.POSITIVE_INFINITY;
  const lastSequenceY =
    anchorRows.length > 0
      ? Math.max(...anchorRows.map((row) => row.centerY))
      : Number.NEGATIVE_INFINITY;

  const headerBottomY = header?.bottomY ?? 0;
  const headerStartY = header ? headerBottomY + visual.medianElementHeight * 0.35 : 0;
  const sequenceStartY =
    anchorRows.length > 0
      ? firstSequenceY - visual.medianElementHeight * 0.6
      : headerStartY;
  const startY = Math.min(headerStartY, sequenceStartY);

  const footerEndY = footerY - visual.medianElementHeight * 0.25;
  const sequenceEndY =
    anchorRows.length > 0
      ? lastSequenceY + visual.medianElementHeight * 1.2
      : footerEndY;
  const endY = Math.min(visual.pageHeight, Math.max(footerEndY, sequenceEndY));

  const declaredItemCount = extractDeclaredItemCount(
    visual.rows.slice(footerStartRowIndex, footerStartRowIndex + 4),
  );

  return {
    startY: Math.max(0, startY),
    endY,
    declaredItemCount,
    footerStartRowIndex,
  };
}

export function getItemRegionRows(
  visual: VisualRowsContext,
  header: DetectedTableHeader | null,
  bounds: ItemRegionBounds,
): VisualRow[] {
  const sequenceRows = findItemSequenceAnchorRows(visual.rows);
  const productRows = visual.rows.filter((row) => looksLikeItemProductRow(row));
  const anchorRows = sequenceRows.length > 0 ? sequenceRows : productRows;
  const sequenceMinY =
    anchorRows.length > 0
      ? Math.min(...anchorRows.map((row) => row.centerY))
      : bounds.startY;
  const sequenceMaxY =
    anchorRows.length > 0
      ? Math.max(...anchorRows.map((row) => row.centerY))
      : bounds.endY;
  const ySlack = visual.medianElementHeight * 0.75;

  return visual.rows.filter((row) => {
    const inHeaderBounds = row.centerY > bounds.startY && row.centerY < bounds.endY;
    const inSequenceBounds =
      anchorRows.length > 0 &&
      row.centerY >= sequenceMinY - ySlack &&
      row.centerY <= sequenceMaxY + ySlack;

    if (!inHeaderBounds && !inSequenceBounds) {
      return false;
    }
    if (isFooterOrPaymentRow(row)) {
      return false;
    }
    if (header && rowIsHeaderRelated(row, header, visual.rowToleranceY)) {
      return false;
    }
    if (rowLooksLikeHeader(row)) {
      return false;
    }
    if (rowMatchesFooterItemCountAnchor(row)) {
      return false;
    }
    return true;
  });
}

function rowIsHeaderRelated(
  row: VisualRow,
  header: DetectedTableHeader,
  rowToleranceY: number,
): boolean {
  return header.rows.some(
    (headerRow) => Math.abs(headerRow.centerY - row.centerY) <= rowToleranceY,
  );
}

function parseSequenceToken(token: string): number | null {
  const digits = token.replace(/\D/g, '');
  if (!/^\d{1,3}$/.test(digits)) {
    return null;
  }
  const value = Number.parseInt(digits, 10);
  if (!Number.isFinite(value) || value < 1 || value > 999) {
    return null;
  }
  return value;
}

function isQuantityUnitToken(token: string): boolean {
  return /^(UN|UND|UNID|KG|G|L|ML|LT|PC|PCT|CX)$/i.test(token);
}

export function extractItemSequenceNumber(row: VisualRow): number | null {
  const sortedElements = [...row.elements].sort(
    (a, b) => a.normalizedCenterX - b.normalizedCenterX || a.centerX - b.centerX,
  );

  for (const element of sortedElements) {
    const match = /^(\d{1,3})$/.exec(element.text.trim());
    if (!match) {
      continue;
    }
    if (element.normalizedCenterX > 0.32) {
      continue;
    }
    const value = parseSequenceToken(match[1]!);
    if (value != null && value <= 99) {
      return value;
    }
  }

  const leading = /^(\d{1,3})\s+(\S+)/.exec(row.text.trim());
  if (leading) {
    const nextToken = leading[2]!;
    if (isQuantityUnitToken(nextToken)) {
      return null;
    }
    const value = parseSequenceToken(leading[1]!);
    if (value != null && value <= 99) {
      return value;
    }
  }

  return null;
}

export function isFooterOrPaymentRow(row: VisualRow): boolean {
  return canonicalIncludesAny(row.text, [
    'VALOR TOTAL',
    'CARTAO',
    'CARTÃO',
    'CREDITO',
    'CRÉDITO',
    'DEBITO',
    'DÉBITO',
    'PIX',
    'DINHEIRO',
    'TROCO',
    'CHAVE DE ACESSO',
    'PROTOCOLO',
  ]);
}

export function rowStartsNewItemGroup(row: VisualRow): boolean {
  if (extractItemSequenceNumber(row) != null) {
    return true;
  }
  const text = row.text.trim();
  return ITEM_ROW_START_PATTERN.test(text) || ITEM_ROW_EAN_START_PATTERN.test(text);
}
