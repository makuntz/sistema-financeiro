import { describe, expect, it } from 'vitest';
import { mapMlKitTextToDocument } from './receipt-ocr-document';
import {
  buildReceiptOcrSpatialPreview,
  getReceiptOcrRectCenterY,
  groupReceiptOcrLinesByRow,
  looksLikeBrazilianRetailPrice,
} from './receipt-ocr-spatial-preview';

describe('receipt-ocr-spatial-preview', () => {
  it('detects Brazilian retail prices', () => {
    expect(looksLikeBrazilianRetailPrice('24,90')).toBe(true);
    expect(looksLikeBrazilianRetailPrice('1.234,56')).toBe(true);
    expect(looksLikeBrazilianRetailPrice('ARROZ')).toBe(false);
  });

  it('groups lines on the same visual row by centerY', () => {
    const document = mapMlKitTextToDocument({
      text: 'ARROZ TIPO 1\n24,90\nLEITE\n5,79',
      platform: 'android',
      blocks: [
        {
          text: 'ARROZ TIPO 1\n24,90\nLEITE\n5,79',
          frame: { left: 0, top: 0, right: 300, bottom: 500 },
          lines: [
            {
              text: 'ARROZ TIPO 1',
              frame: { left: 10, top: 400, right: 180, bottom: 420 },
              elements: [
                { text: 'ARROZ TIPO 1', frame: { left: 10, top: 400, right: 180, bottom: 420 } },
              ],
            },
            {
              text: '24,90',
              frame: { left: 220, top: 401, right: 280, bottom: 421 },
              elements: [{ text: '24,90', frame: { left: 220, top: 401, right: 280, bottom: 421 } }],
            },
            {
              text: 'LEITE',
              frame: { left: 10, top: 430, right: 100, bottom: 450 },
              elements: [{ text: 'LEITE', frame: { left: 10, top: 430, right: 100, bottom: 450 } }],
            },
            {
              text: '5,79',
              frame: { left: 230, top: 431, right: 280, bottom: 451 },
              elements: [{ text: '5,79', frame: { left: 230, top: 431, right: 280, bottom: 451 } }],
            },
          ],
        },
      ],
    });

    const rows = buildReceiptOcrSpatialPreview(document);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.preview).toBe('ARROZ TIPO 1 → R$ 24,90');
    expect(rows[1]?.preview).toBe('LEITE → R$ 5,79');
    expect(getReceiptOcrRectCenterY(rows[0]!.lines[0]!.frame)).toBe(410);
  });

  it('keeps separate rows when centerY differs beyond tolerance', () => {
    const groups = groupReceiptOcrLinesByRow([
      {
        text: 'A',
        frame: { left: 0, top: 10, right: 20, bottom: 30 },
        elements: [],
      },
      {
        text: 'B',
        frame: { left: 0, top: 80, right: 20, bottom: 100 },
        elements: [],
      },
    ]);

    expect(groups).toHaveLength(2);
  });
});
