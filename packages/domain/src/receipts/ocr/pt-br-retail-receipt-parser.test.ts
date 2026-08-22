import { describe, expect, it } from 'vitest';
import { canonicalizeForMatching, normalizeOcrText, removeItemPrefixTokens } from './normalize.js';
import {
  extractMoneyCandidates,
  looksLikeMoneyText,
  parseBrazilianMoneyToCents,
  pickBestLineTotalCents,
  stripTaxStatusTokens,
} from './money-parser.js';
import { extractPurchaseDate } from './date-parser.js';
import { getCenterY, groupLinesByRow } from './spatial.js';
import {
  PtBrRetailReceiptParser,
  buildOcrDocumentFromLines,
} from './pt-br-retail-receipt-parser.js';

describe('ocr normalize', () => {
  it('normalizes unicode and spaces', () => {
    expect(normalizeOcrText('  CERV.   HEIN.  ')).toBe('CERV. HEIN.');
    expect(canonicalizeForMatching('CERV. HEIN. LN 350ML')).toBe('CERV HEIN LN 350ML');
  });

  it('removes item number and ean prefixes', () => {
    expect(removeItemPrefixTokens('01 7890000000001 AGUA MINERAL 1,5L')).toBe('AGUA MINERAL 1,5L');
  });
});

describe('ocr money parser', () => {
  it('parses Brazilian money formats without float', () => {
    expect(parseBrazilianMoneyToCents('24,90')).toBe('2490');
    expect(parseBrazilianMoneyToCents('R$ 1.234,56')).toBe('123456');
    expect(parseBrazilianMoneyToCents('1234.56')).toBe('123456');
  });

  it('rejects cnpj-like and date-like values', () => {
    expect(parseBrazilianMoneyToCents('12.345.678/0001-90')).toBeNull();
    expect(parseBrazilianMoneyToCents('22/08/2026')).toBeNull();
  });

  it('extracts multiple candidates from a line', () => {
    expect(extractMoneyCandidates('TOTAL R$ 291,24')).toEqual(['29124']);
    expect(looksLikeMoneyText('24,90')).toBe(true);
  });

  it('does not merge NFC-e tax code T10 with price 7,99', () => {
    const line = '01 AGUA MIN PRATA 1 UN 7,99 T10 7,99';
    expect(stripTaxStatusTokens(line)).not.toContain('T10');
    expect(extractMoneyCandidates(line)).toEqual(['799', '799']);
    expect(pickBestLineTotalCents(extractMoneyCandidates(line))).toBe('799');
    expect(parseBrazilianMoneyToCents('T10 7,99')).toBe('799');
  });

  it('ignores product volume like 1,270 in descriptions', () => {
    expect(extractMoneyCandidates('AGUA MIN PRATA 1,270 1 UN 7,99')).toEqual(['799']);
    expect(parseBrazilianMoneyToCents('1,270')).toBeNull();
  });
});

describe('ocr date parser', () => {
  it('prioritizes purchase date anchors', () => {
    const parsed = extractPurchaseDate([
      'SUPERMERCADO EXEMPLO',
      'VALIDADE 01/09/2026',
      'DATA 22/08/2026 09:15:32',
    ]);
    expect(parsed?.value).toBe('2026-08-22');
  });
});

describe('ocr spatial', () => {
  it('groups lines by relative centerY tolerance', () => {
    const groups = groupLinesByRow(
      [
        {
          index: 0,
          text: 'ARROZ',
          canonicalText: 'ARROZ',
          frame: { left: 0, top: 400, right: 100, bottom: 420 },
          centerX: 50,
          centerY: 410,
          width: 100,
          height: 20,
          elements: [],
        },
        {
          index: 1,
          text: '24,90',
          canonicalText: '24,90',
          frame: { left: 300, top: 401, right: 360, bottom: 421 },
          centerX: 330,
          centerY: 411,
          width: 60,
          height: 20,
          elements: [],
        },
      ],
      12,
    );
    expect(groups).toHaveLength(1);
    expect(getCenterY(groups[0]![0]!.frame)).toBe(410);
  });
});

describe('PtBrRetailReceiptParser', () => {
  const parser = new PtBrRetailReceiptParser();

  it('parses NFC-e ST column without merging T10 with price', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'VILA RICA SUPERMERCADOS' },
      { text: 'DESCRICAO QTD VL UNIT ST TOTAL' },
      {
        text: '01 07897123884029 AGUA MIN PRATA 1 UN 7,99 T10',
        rightText: '7,99',
      },
      { text: 'QTD. TOTAL DE ITENS' },
      { text: 'VALOR TOTAL (R$)', rightText: '291,38' },
    ]);

    const result = parser.parse(document);
    expect(result.items[0]?.rawDescription).toContain('AGUA MIN PRATA');
    expect(result.items[0]?.lineTotalInCents).toBe('799');
    expect(result.totalAmountInCents).toBe('29138');
  });

  it('uses TOTAL column instead of volume in description (1,270)', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'VILA RICA SUPERMERCADOS' },
      {
        parts: [
          { text: 'COD', xStart: 10, xEnd: 35 },
          { text: 'DESCRICAO', xStart: 40, xEnd: 110 },
          { text: 'QTD', xStart: 115, xEnd: 145 },
          { text: 'VL UNIT', xStart: 150, xEnd: 205 },
          { text: 'ST', xStart: 210, xEnd: 235 },
          { text: 'TOTAL', xStart: 330, xEnd: 390 },
        ],
      },
      {
        parts: [
          { text: '01 07897123884029 AGUA MIN PRATA 1,270', xStart: 10, xEnd: 220 },
          { text: '1 UN', xStart: 115, xEnd: 145 },
          { text: '7,99', xStart: 150, xEnd: 205 },
          { text: 'T10', xStart: 210, xEnd: 235 },
          { text: '7,99', xStart: 330, xEnd: 390 },
        ],
      },
      { text: 'QTD. TOTAL DE ITENS' },
      { text: 'VALOR TOTAL (R$)', rightText: '291,38' },
    ]);

    const result = parser.parse(document);
    expect(result.items[0]?.lineTotalInCents).toBe('799');
  });

  it('skips OCR-misread discount lines and applies discount to previous item', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO QTD VL UNIT ST TOTAL' },
      { text: '21 SAB DOVE 90G', rightText: '5,89' },
      { text: 'Descorto (VF: 4,89)', rightText: '-1,00' },
      { text: 'VALOR TOTAL R$', rightText: '4,89' },
    ]);

    const result = parser.parse(document);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.rawDescription).toContain('SAB DOVE');
    expect(result.items[0]?.lineTotalInCents).toBe('489');
    expect(result.items[0]?.needsReview).toBe(true);
  });

  it('merges split product line with price continuation row', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO QTD VL UNIT ST TOTAL' },
      { text: '21 07898422746759 SAB DOVE 90G' },
      { text: '1 UN x 5,89 T10 5,89' },
      { text: 'VALOR TOTAL R$', rightText: '5,89' },
    ]);

    const result = parser.parse(document);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.rawDescription).toContain('SAB DOVE');
    expect(result.items[0]?.lineTotalInCents).toBe('589');
  });

  it('groups multi-line OCR rows like ML Kit output', () => {
    const document = buildOcrDocumentFromLines(
      [
        { text: 'VILA RICA SUPERMERCADOS' },
        { text: 'DESCRICAO QTD VL UNIT ST TOTAL', y: 50 },
        { text: '01 07897123884029 AGUA MIN PRATA 1,270', y: 74 },
        { text: '1 UN x 7,99 T10 7,99', y: 98 },
        { text: '21 07898422746759 SAB DOVE 90G', y: 122 },
        { text: '1 UN x 5,89 T10 5,89', y: 146 },
        { text: 'Descorto (VF: 4,89) -1,00', y: 170 },
        { text: 'QTD. TOTAL DE ITENS', y: 400 },
        { text: 'VALOR TOTAL (R$)', y: 424, rightText: '291,38' },
      ],
      { lineHeight: 24 },
    );

    const result = parser.parse(document);
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items[0]?.lineTotalInCents).toBe('799');
    expect(result.items[1]?.lineTotalInCents).toBe('489');
    expect(result.totalAmountInCents).toBe('29138');
    expect(result.items.filter((item) => item.needsReview).length).toBeLessThanOrEqual(1);
  });

  it('parses simple supermarket receipt fixture', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'CNPJ 12.345.678/0001-90' },
      { text: 'DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA' },
      { text: 'DATA 22/08/2026' },
      { text: 'DESCRICAO' },
      { text: '01 7890000000001 AGUA MINERAL 1,5L', rightText: '4,50' },
      { text: '02 7890000000002 REQUEIJAO 250G', rightText: '8,90' },
      { text: 'ARROZ TIPO 1 5KG', rightText: '24,90' },
      { text: 'QTD TOTAL DE ITENS' },
      { text: 'VALOR TOTAL R$', rightText: '38,30' },
    ]);

    const result = parser.parse(document);
    expect(result.merchantName).toBe('SUPERMERCADO EXEMPLO');
    expect(result.purchaseDate).toBe('2026-08-22');
    expect(result.totalAmountInCents).toBe('3830');
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.items.some((item) => item.rawDescription.includes('AGUA MINERAL'))).toBe(true);
  });

  it('parses weighted product and two-line item', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO' },
      { text: '04 7890000000004 BATATA KG', rightText: '0,00' },
      { text: '0,836 KG X 6,99', rightText: '5,84' },
      { text: 'FILE PEITO FRANG 1KG' },
      { text: '1 UN X 18,90', rightText: '18,90' },
      { text: 'VALOR TOTAL R$', rightText: '24,74' },
    ]);

    const result = parser.parse(document);
    expect(result.items.some((item) => item.unitOfMeasure === 'KG')).toBe(true);
    expect(result.items.some((item) => item.lineTotalInCents === '584')).toBe(true);
  });

  it('merges price row without X separator (OCR variant)', () => {
    const document = buildOcrDocumentFromLines(
      [
        { text: 'SUPERMERCADO EXEMPLO' },
        { text: 'DESCRICAO QTD VL UNIT ST TOTAL', y: 50 },
        { text: '21 07898422746759 SAB DOVE 90G', y: 74 },
        { text: '1 UN 5,89 T10 5,89', y: 98 },
        { text: 'VALOR TOTAL R$', y: 200, rightText: '5,89' },
      ],
      { lineHeight: 24 },
    );

    const result = parser.parse(document);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lineTotalInCents).toBe('589');
    expect(result.items[0]?.needsReview).toBe(false);
  });

  it('coalesces orphan price row split into previous item group', () => {
    const document = buildOcrDocumentFromLines(
      [
        { text: 'SUPERMERCADO EXEMPLO' },
        { text: 'DESCRICAO QTD VL UNIT ST TOTAL', y: 50 },
        { text: '21 07898422746759 SAB DOVE 90G', y: 74 },
        { text: '22 0789000000001 ARROZ 5KG', y: 98 },
        { text: '1 UN 5,89 T10 5,89', y: 122 },
        { text: '1 UN 24,90 T10 24,90', y: 146 },
        { text: 'VALOR TOTAL R$', y: 300, rightText: '30,79' },
      ],
      { lineHeight: 24 },
    );

    const result = parser.parse(document);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.lineTotalInCents).toBe('589');
    expect(result.items[1]?.lineTotalInCents).toBe('2490');
    expect(result.items.filter((item) => item.needsReview).length).toBe(0);
  });

  it('flags discount lines for review on previous item', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO' },
      { text: 'SABONETE 90G', rightText: '4,89' },
      { text: 'Desconto (VF: 4,89)' },
      { text: 'VALOR TOTAL R$', rightText: '0,00' },
    ]);

    const result = parser.parse(document);
    expect(result.items[0]?.warnings.join(' ')).toMatch(/Desconto associado/);
    expect(result.items[0]?.needsReview).toBe(true);
  });

  it('does not create payment lines as items', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO' },
      { text: 'LEITE 1L', rightText: '5,79' },
      { text: 'VALOR TOTAL R$', rightText: '5,79' },
      { text: 'CARTAO CREDITO', rightText: '5,79' },
    ]);

    const result = parser.parse(document);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.rawDescription).toBe('LEITE 1L');
  });

  it('creates item without value and marks needsReview', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO' },
      { text: 'PRODUTO SEM PRECO' },
      { text: 'VALOR TOTAL R$', rightText: '10,00' },
    ]);

    const result = parser.parse(document);
    expect(result.items[0]?.lineTotalInCents).toBeNull();
    expect(result.items[0]?.needsReview).toBe(true);
  });

  it('throws when no items are found', () => {
    const document = buildOcrDocumentFromLines([
      { text: 'SUPERMERCADO EXEMPLO' },
      { text: 'DESCRICAO' },
      { text: 'QTD TOTAL DE ITENS' },
      { text: 'VALOR TOTAL R$', rightText: '10,00' },
    ]);

    expect(() => parser.parse(document)).toThrow(/produtos desta nota/);
  });
});
