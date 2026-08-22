import { describe, expect, it } from 'vitest';
import {
  countReceiptOcrStats,
  flattenReceiptOcrLines,
  getReceiptOcrFullText,
  mapMlKitTextToDocument,
} from './receipt-ocr-document';

describe('receipt-ocr-document', () => {
  it('maps ML Kit blocks into ReceiptOcrDocument with page bounds', () => {
    const document = mapMlKitTextToDocument({
      text: 'ARROZ\n24,90',
      platform: 'android',
      blocks: [
        {
          text: 'ARROZ\n24,90',
          frame: { left: 10, top: 20, right: 200, bottom: 80 },
          lines: [
            {
              text: 'ARROZ',
              frame: { left: 10, top: 20, right: 120, bottom: 40 },
              elements: [{ text: 'ARROZ', frame: { left: 10, top: 20, right: 120, bottom: 40 } }],
            },
            {
              text: '24,90',
              frame: { left: 150, top: 55, right: 200, bottom: 80 },
              elements: [{ text: '24,90', frame: { left: 150, top: 55, right: 200, bottom: 80 } }],
            },
          ],
        },
      ],
    });

    expect(document.engine).toBe('google_mlkit_text_recognition_v2');
    expect(document.platform).toBe('android');
    expect(document.pages).toHaveLength(1);
    expect(document.pages[0]?.width).toBe(200);
    expect(document.pages[0]?.height).toBe(80);

    const stats = countReceiptOcrStats(document);
    expect(stats).toEqual({ blockCount: 1, lineCount: 2, elementCount: 2 });
    expect(getReceiptOcrFullText(document)).toBe('ARROZ\n24,90');
    expect(flattenReceiptOcrLines(document)).toHaveLength(2);
  });
});
