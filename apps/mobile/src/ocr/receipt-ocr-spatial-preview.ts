import type { ReceiptOcrDocument, ReceiptOcrLine, ReceiptOcrRect } from './receipt-ocr-document';
import { flattenReceiptOcrLines } from './receipt-ocr-document';

export const DEFAULT_ROW_TOLERANCE_PX = 12;

const PRICE_PATTERN = /^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/;

export type ReceiptOcrSpatialElement = {
  text: string;
  frame: ReceiptOcrRect;
  centerX: number;
  centerY: number;
  normalizedCenterX: number;
};

export type ReceiptOcrSpatialRow = {
  rowIndex: number;
  centerY: number;
  lines: ReceiptOcrLine[];
  elements: ReceiptOcrSpatialElement[];
  leftText: string;
  price: string | null;
  preview: string;
};

export function getReceiptOcrRectCenterY(frame: ReceiptOcrRect): number {
  return (frame.top + frame.bottom) / 2;
}

export function getReceiptOcrRectCenterX(frame: ReceiptOcrRect): number {
  return (frame.left + frame.right) / 2;
}

export function looksLikeBrazilianRetailPrice(text: string): boolean {
  return PRICE_PATTERN.test(text.trim());
}

export function groupReceiptOcrLinesByRow(
  lines: ReceiptOcrLine[],
  tolerancePx = DEFAULT_ROW_TOLERANCE_PX,
): ReceiptOcrLine[][] {
  if (lines.length === 0) {
    return [];
  }

  const sorted = [...lines].sort(
    (a, b) =>
      getReceiptOcrRectCenterY(a.frame) - getReceiptOcrRectCenterY(b.frame) ||
      getReceiptOcrRectCenterX(a.frame) - getReceiptOcrRectCenterX(b.frame),
  );

  const groups: ReceiptOcrLine[][] = [];
  let current: ReceiptOcrLine[] = [sorted[0]!];
  let rowCenterY = getReceiptOcrRectCenterY(sorted[0]!.frame);

  for (let index = 1; index < sorted.length; index += 1) {
    const line = sorted[index]!;
    const centerY = getReceiptOcrRectCenterY(line.frame);

    if (Math.abs(centerY - rowCenterY) <= tolerancePx) {
      current.push(line);
      rowCenterY =
        current.reduce((sum, item) => sum + getReceiptOcrRectCenterY(item.frame), 0) / current.length;
      continue;
    }

    current.sort((a, b) => getReceiptOcrRectCenterX(a.frame) - getReceiptOcrRectCenterX(b.frame));
    groups.push(current);
    current = [line];
    rowCenterY = centerY;
  }

  current.sort((a, b) => getReceiptOcrRectCenterX(a.frame) - getReceiptOcrRectCenterX(b.frame));
  groups.push(current);

  return groups;
}

function lineToSpatialElements(line: ReceiptOcrLine, pageWidth: number): ReceiptOcrSpatialElement[] {
  const source =
    line.elements.length > 0
      ? line.elements
      : [{ text: line.text, frame: line.frame }];

  return source.map((element) => {
    const centerX = getReceiptOcrRectCenterX(element.frame);
    return {
      text: element.text,
      frame: element.frame,
      centerX,
      centerY: getReceiptOcrRectCenterY(element.frame),
      normalizedCenterX: pageWidth > 0 ? centerX / pageWidth : 0,
    };
  });
}

function buildRowPreview(
  rowLines: ReceiptOcrLine[],
  pageWidth: number,
): Pick<ReceiptOcrSpatialRow, 'leftText' | 'price' | 'preview'> {
  const elements = rowLines
    .flatMap((line) => lineToSpatialElements(line, pageWidth))
    .sort((a, b) => a.centerX - b.centerX);

  const priceElements = elements.filter((element) => looksLikeBrazilianRetailPrice(element.text));
  const descriptionElements = elements.filter((element) => !looksLikeBrazilianRetailPrice(element.text));

  if (priceElements.length > 0 && descriptionElements.length > 0) {
    const leftText = descriptionElements.map((element) => element.text).join(' ').trim();
    const price = priceElements[priceElements.length - 1]!.text.trim();
    return {
      leftText,
      price,
      preview: `${leftText} → R$ ${price}`,
    };
  }

  if (rowLines.length >= 2) {
    const lastLine = rowLines[rowLines.length - 1]!;
    const lastText = lastLine.text.trim();
    if (looksLikeBrazilianRetailPrice(lastText)) {
      const leftText = rowLines
        .slice(0, -1)
        .map((line) => line.text)
        .join(' ')
        .trim();
      return {
        leftText,
        price: lastText,
        preview: `${leftText} → R$ ${lastText}`,
      };
    }
  }

  const joined = rowLines.map((line) => line.text).join(' | ').trim();
  return {
    leftText: joined,
    price: null,
    preview: joined,
  };
}

export function buildReceiptOcrSpatialPreview(
  document: ReceiptOcrDocument,
  tolerancePx = DEFAULT_ROW_TOLERANCE_PX,
): ReceiptOcrSpatialRow[] {
  const pageWidth = document.pages[0]?.width ?? 1;
  const rowGroups = groupReceiptOcrLinesByRow(flattenReceiptOcrLines(document), tolerancePx);

  return rowGroups.map((lines, rowIndex) => {
    const elements = lines.flatMap((line) => lineToSpatialElements(line, pageWidth));
    const centerY =
      elements.reduce((sum, element) => sum + element.centerY, 0) / Math.max(elements.length, 1);
    const previewParts = buildRowPreview(lines, pageWidth);

    return {
      rowIndex,
      centerY,
      lines,
      elements,
      ...previewParts,
    };
  });
}
