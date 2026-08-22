export type {
  ReceiptOcrDocument,
  ReceiptOcrPage,
  ReceiptOcrBlock,
  ReceiptOcrLine,
  ReceiptOcrElement,
  ReceiptOcrRect,
} from '@pp-planning/contracts';

import type {
  ReceiptOcrBlock,
  ReceiptOcrDocument,
  ReceiptOcrRect,
} from '@pp-planning/contracts';

export type ReceiptOcrStats = {
  blockCount: number;
  lineCount: number;
  elementCount: number;
};

export function countReceiptOcrStats(document: ReceiptOcrDocument): ReceiptOcrStats {
  let blockCount = 0;
  let lineCount = 0;
  let elementCount = 0;

  for (const page of document.pages) {
    blockCount += page.blocks.length;
    for (const block of page.blocks) {
      lineCount += block.lines.length;
      for (const line of block.lines) {
        elementCount += line.elements.length;
      }
    }
  }

  return { blockCount, lineCount, elementCount };
}

export function flattenReceiptOcrLines(document: ReceiptOcrDocument) {
  const lines = [];
  for (const page of document.pages) {
    for (const block of page.blocks) {
      lines.push(...block.lines);
    }
  }
  return lines;
}

export function getReceiptOcrFullText(document: ReceiptOcrDocument): string {
  return document.pages
    .flatMap((page) => page.blocks.map((block) => block.text))
    .join('\n')
    .trim();
}

function computePageBounds(blocks: ReceiptOcrBlock[]): { width: number; height: number } {
  if (blocks.length === 0) {
    return { width: 0, height: 0 };
  }

  let maxRight = 0;
  let maxBottom = 0;
  for (const block of blocks) {
    maxRight = Math.max(maxRight, block.frame.right);
    maxBottom = Math.max(maxBottom, block.frame.bottom);
  }

  return { width: Math.ceil(maxRight), height: Math.ceil(maxBottom) };
}

export function mapMlKitTextToDocument(input: {
  text: string;
  blocks: Array<{
    text: string;
    frame: ReceiptOcrRect;
    lines: Array<{
      text: string;
      frame: ReceiptOcrRect;
      elements: Array<{
        text: string;
        frame: ReceiptOcrRect;
      }>;
    }>;
  }>;
  platform: 'android' | 'ios';
  engineVersion?: string | null;
}): ReceiptOcrDocument {
  const blocks: ReceiptOcrBlock[] = input.blocks.map((block) => ({
    text: block.text,
    frame: block.frame,
    lines: block.lines.map((line) => ({
      text: line.text,
      frame: line.frame,
      elements: line.elements.map((element) => ({
        text: element.text,
        frame: element.frame,
      })),
    })),
  }));

  const bounds = computePageBounds(blocks);

  return {
    engine: 'google_mlkit_text_recognition_v2',
    engineVersion: input.engineVersion ?? null,
    platform: input.platform,
    pages: [
      {
        width: bounds.width,
        height: bounds.height,
        blocks,
      },
    ],
  };
}
