import {
  canonicalIncludesAny,
  extractMoneyCandidates,
  parseBrazilianMoneyToCents,
  pickBestLineTotalCents,
} from './money-parser.js';
import { TOTAL_NEGATIVE_ANCHORS, TOTAL_POSITIVE_ANCHORS } from './anchors.js';
import type { VisualRow, VisualRowsContext } from './visual-rows.js';
import { findRowsNearY } from './visual-rows.js';
import { rowHasPaymentAnchor } from './money-clusters.js';

export function findValueNearLabel(input: {
  rows: VisualRow[];
  labelPatterns: readonly string[];
  negativePatterns?: readonly string[];
  startRowIndex?: number;
  rowToleranceY: number;
  preferRightOfLabel?: boolean;
}): { cents: string; source: string } | null {
  const start = input.startRowIndex ?? 0;

  for (let index = start; index < input.rows.length; index += 1) {
    const row = input.rows[index]!;
    if (!canonicalIncludesAny(row.text, input.labelPatterns)) {
      continue;
    }
    if (input.negativePatterns && canonicalIncludesAny(row.text, input.negativePatterns)) {
      continue;
    }
    if (rowHasPaymentAnchor(row)) {
      continue;
    }

    const clusterRows = findRowsNearY(input.rows, row.centerY, input.rowToleranceY);
    const moneyElements = clusterRows
      .flatMap((clusterRow) => clusterRow.elements)
      .filter((element) => parseBrazilianMoneyToCents(element.text) != null);

    const sameRowValues = extractMoneyCandidates(row.text);
    if (sameRowValues.length > 0) {
      const value = pickBestLineTotalCents(sameRowValues);
      if (value) {
        return { cents: value, source: row.text };
      }
    }

    const labelCenterX = row.elements[0]?.centerX ?? row.centerY;
    const rightSide = moneyElements.filter((element) => element.centerX >= labelCenterX - 8);
    const pool = input.preferRightOfLabel === false ? moneyElements : rightSide.length > 0 ? rightSide : moneyElements;

    if (pool.length === 0) {
      continue;
    }

    pool.sort((a, b) => b.centerX - a.centerX);
    const best = pool[0]!;
    const cents = parseBrazilianMoneyToCents(best.text);
    if (cents) {
      return { cents, source: `${row.text} | ${best.text}` };
    }
  }

  return null;
}

export function extractReceiptTotalInCents(
  visual: VisualRowsContext,
  footerStartRowIndex: number,
): { totalAmountInCents: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const footerRows = visual.rows.slice(
    Math.max(0, footerStartRowIndex - 1),
    Math.min(visual.rows.length, footerStartRowIndex + 8),
  );

  const found = findValueNearLabel({
    rows: footerRows,
    labelPatterns: TOTAL_POSITIVE_ANCHORS,
    negativePatterns: TOTAL_NEGATIVE_ANCHORS,
    rowToleranceY: visual.rowToleranceY,
    preferRightOfLabel: true,
  });

  if (!found) {
    warnings.push('Total da nota não identificado.');
    return { totalAmountInCents: null, warnings };
  }

  return { totalAmountInCents: found.cents, warnings };
}
