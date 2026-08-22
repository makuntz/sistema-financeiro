import type { ReceiptOcrDocument, ReceiptOcrRect } from '@pp-planning/contracts';
import { flattenOcrLines } from './spatial.js';
import { normalizeOcrText } from './normalize.js';

export type SpatialElement = {
  text: string;
  frame: ReceiptOcrRect;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  normalizedLeft: number;
  normalizedRight: number;
  normalizedCenterX: number;
  normalizedTop: number;
  normalizedBottom: number;
  normalizedCenterY: number;
};

export type VisualRow = {
  index: number;
  centerY: number;
  normalizedCenterY: number;
  elements: SpatialElement[];
  text: string;
};

export type VisualRowsContext = {
  pageWidth: number;
  pageHeight: number;
  medianElementHeight: number;
  rowToleranceY: number;
  rows: VisualRow[];
  elements: SpatialElement[];
};

function getCenterX(frame: ReceiptOcrRect): number {
  return (frame.left + frame.right) / 2;
}

function getCenterY(frame: ReceiptOcrRect): number {
  return (frame.top + frame.bottom) / 2;
}

function getWidth(frame: ReceiptOcrRect): number {
  return Math.max(0, frame.right - frame.left);
}

function getHeight(frame: ReceiptOcrRect): number {
  return Math.max(0, frame.bottom - frame.top);
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function normalizeCoordinate(value: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 0;
  }
  return value / pageSize;
}

export function flattenDocumentElements(
  document: ReceiptOcrDocument,
  pageWidth: number,
  pageHeight: number,
): SpatialElement[] {
  const elements: SpatialElement[] = [];

  for (const line of flattenOcrLines(document)) {
    const sourceElements =
      line.elements.length > 0
        ? line.elements
        : [{ text: line.text, frame: line.frame }];

    for (const element of sourceElements) {
      const text = normalizeOcrText(element.text);
      if (!text) {
        continue;
      }

      const frame = element.frame;
      const centerX = getCenterX(frame);
      const centerY = getCenterY(frame);

      elements.push({
        text,
        frame,
        centerX,
        centerY,
        width: getWidth(frame),
        height: getHeight(frame),
        normalizedLeft: normalizeCoordinate(frame.left, pageWidth),
        normalizedRight: normalizeCoordinate(frame.right, pageWidth),
        normalizedCenterX: normalizeCoordinate(centerX, pageWidth),
        normalizedTop: normalizeCoordinate(frame.top, pageHeight),
        normalizedBottom: normalizeCoordinate(frame.bottom, pageHeight),
        normalizedCenterY: normalizeCoordinate(centerY, pageHeight),
      });
    }
  }

  return elements.sort(
    (a, b) => a.centerY - b.centerY || a.centerX - b.centerX || a.text.localeCompare(b.text),
  );
}

export function buildVisualRows(document: ReceiptOcrDocument): VisualRowsContext {
  const page = document.pages[0];
  const pageWidth = page?.width ?? 0;
  const pageHeight = page?.height ?? 0;
  const elements = flattenDocumentElements(document, pageWidth, pageHeight);

  const heights = elements
    .map((element) => element.height)
    .filter((value) => value > 0 && value <= pageHeight * 0.08)
    .sort((a, b) => a - b);

  const medianElementHeight = Math.max(8, median(heights));
  const rowToleranceY = Math.max(8, medianElementHeight * 0.55);

  const rows: VisualRow[] = [];
  let current: SpatialElement[] = [];
  let rowCenterY = 0;

  for (const element of elements) {
    if (current.length === 0) {
      current = [element];
      rowCenterY = element.centerY;
      continue;
    }

    if (Math.abs(element.centerY - rowCenterY) <= rowToleranceY) {
      current.push(element);
      rowCenterY =
        current.reduce((sum, item) => sum + item.centerY, 0) / Math.max(current.length, 1);
      continue;
    }

    current.sort((a, b) => a.centerX - b.centerX || a.text.localeCompare(b.text));
    rows.push({
      index: rows.length,
      centerY: rowCenterY,
      normalizedCenterY: normalizeCoordinate(rowCenterY, pageHeight),
      elements: current,
      text: current.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim(),
    });
    current = [element];
    rowCenterY = element.centerY;
  }

  if (current.length > 0) {
    current.sort((a, b) => a.centerX - b.centerX || a.text.localeCompare(b.text));
    rows.push({
      index: rows.length,
      centerY: rowCenterY,
      normalizedCenterY: normalizeCoordinate(rowCenterY, pageHeight),
      elements: current,
      text: current.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim(),
    });
  }

  return {
    pageWidth,
    pageHeight,
    medianElementHeight,
    rowToleranceY,
    rows,
    elements,
  };
}

export function joinVisualRowText(row: VisualRow): string {
  return row.text;
}

export function findRowsNearY(
  rows: VisualRow[],
  centerY: number,
  toleranceY: number,
): VisualRow[] {
  return rows.filter((row) => Math.abs(row.centerY - centerY) <= toleranceY);
}
