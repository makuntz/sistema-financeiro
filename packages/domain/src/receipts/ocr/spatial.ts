import type { ReceiptOcrDocument, ReceiptOcrLine, ReceiptOcrRect } from '@pp-planning/contracts';

export type NormalizedOcrElement = {
  text: string;
  frame: ReceiptOcrRect;
  centerX: number;
  centerY: number;
};

export type NormalizedOcrLine = {
  index: number;
  text: string;
  canonicalText: string;
  frame: ReceiptOcrRect;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  elements: NormalizedOcrElement[];
};

export type SpatialContext = {
  pageWidth: number;
  pageHeight: number;
  averageLineHeight: number;
  rowToleranceY: number;
  rightColumnThresholdX: number;
};

export function getCenterX(frame: ReceiptOcrRect): number {
  return (frame.left + frame.right) / 2;
}

export function getCenterY(frame: ReceiptOcrRect): number {
  return (frame.top + frame.bottom) / 2;
}

export function getWidth(frame: ReceiptOcrRect): number {
  return Math.max(0, frame.right - frame.left);
}

export function getHeight(frame: ReceiptOcrRect): number {
  return Math.max(0, frame.bottom - frame.top);
}

export function flattenOcrLines(document: ReceiptOcrDocument): ReceiptOcrLine[] {
  const lines: ReceiptOcrLine[] = [];
  for (const page of document.pages) {
    for (const block of page.blocks) {
      lines.push(...block.lines);
    }
  }
  return lines;
}

export function buildSpatialContext(document: ReceiptOcrDocument): SpatialContext {
  const page = document.pages[0];
  const pageWidth = page?.width ?? 0;
  const pageHeight = page?.height ?? 0;
  const lines = flattenOcrLines(document);
  const heights = lines.map((line) => getHeight(line.frame)).filter((value) => value > 0);
  const averageLineHeight =
    heights.length > 0 ? heights.reduce((sum, value) => sum + value, 0) / heights.length : 16;

  return {
    pageWidth,
    pageHeight,
    averageLineHeight,
    rowToleranceY: Math.max(8, averageLineHeight * 0.45),
    rightColumnThresholdX: pageWidth > 0 ? pageWidth * 0.62 : 0,
  };
}

export function groupLinesByRow(
  lines: NormalizedOcrLine[],
  rowToleranceY: number,
): NormalizedOcrLine[][] {
  if (lines.length === 0) {
    return [];
  }

  const sorted = [...lines].sort(
    (a, b) => a.centerY - b.centerY || a.centerX - b.centerX || a.index - b.index,
  );

  const groups: NormalizedOcrLine[][] = [];
  let current: NormalizedOcrLine[] = [sorted[0]!];
  let rowCenterY = sorted[0]!.centerY;

  for (let index = 1; index < sorted.length; index += 1) {
    const line = sorted[index]!;
    if (Math.abs(line.centerY - rowCenterY) <= rowToleranceY) {
      current.push(line);
      rowCenterY =
        current.reduce((sum, item) => sum + item.centerY, 0) / Math.max(current.length, 1);
      continue;
    }

    current.sort((a, b) => a.centerX - b.centerX || a.index - b.index);
    groups.push(current);
    current = [line];
    rowCenterY = line.centerY;
  }

  current.sort((a, b) => a.centerX - b.centerX || a.index - b.index);
  groups.push(current);
  return groups;
}

export function joinRowText(row: NormalizedOcrLine[]): string {
  return row
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateTokenPositionsInLine(line: {
  text: string;
  frame: ReceiptOcrRect;
}): Array<{ text: string; centerX: number }> {
  const text = line.text.trim();
  if (!text) {
    return [];
  }

  const width = Math.max(1, line.frame.right - line.frame.left);
  const tokens = text.split(/\s+/).filter(Boolean);
  const positions: Array<{ text: string; centerX: number }> = [];
  let searchFrom = 0;

  for (const token of tokens) {
    const index = text.indexOf(token, searchFrom);
    if (index < 0) {
      continue;
    }
    const tokenCenter = index + token.length / 2;
    const centerX = line.frame.left + (tokenCenter / Math.max(text.length, 1)) * width;
    positions.push({ text: token, centerX });
    searchFrom = index + token.length;
  }

  return positions;
}

export function splitRowByRightColumn(
  row: NormalizedOcrLine[],
  rightColumnThresholdX: number,
): { leftText: string; rightText: string } {
  const leftParts: string[] = [];
  const rightParts: string[] = [];

  for (const line of row) {
    const elements =
      line.elements.length > 0
        ? line.elements
        : [{ text: line.text, frame: line.frame, centerX: line.centerX, centerY: line.centerY }];

    for (const element of elements) {
      const text = element.text.trim();
      if (!text) {
        continue;
      }
      if (element.centerX >= rightColumnThresholdX) {
        rightParts.push(text);
      } else {
        leftParts.push(text);
      }
    }
  }

  return {
    leftText: leftParts.join(' ').replace(/\s+/g, ' ').trim(),
    rightText: rightParts.join(' ').replace(/\s+/g, ' ').trim(),
  };
}
