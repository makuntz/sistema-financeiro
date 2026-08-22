import type { ReceiptOcrDocument, ReceiptOcrElement, ReceiptOcrLine } from '@pp-planning/contracts';

const PAGE_WIDTH = 1000;
const LINE_HEIGHT = 22;

const COL = {
  seq: 50,
  ean: 140,
  desc: 300,
  qtd: 660,
  unitPrice: 760,
  tax: 840,
  total: 940,
} as const;

type ItemSpec = {
  seq: number;
  ean: string;
  description: string;
  lineTotal: string;
  quantityLine?: string;
  unitPrice?: string;
  tax?: string;
  discountLine?: string;
};

const VILA_RICA_ITEMS: ItemSpec[] = [
  { seq: 1, ean: '07897123884029', description: 'AGUA MIN PRATA 1,270', lineTotal: '7,99', quantityLine: '1 UN X 7,99', unitPrice: '7,99', tax: 'T10' },
  { seq: 2, ean: '07897123884029', description: 'AGUA MIN PRATA 1,270', lineTotal: '7,99', quantityLine: '1 UN X 7,99', unitPrice: '7,99', tax: 'T10' },
  { seq: 3, ean: '07897123884029', description: 'AGUA MIN PRATA 1,270', lineTotal: '7,99', quantityLine: '1 UN X 7,99', unitPrice: '7,99', tax: 'T10' },
  { seq: 4, ean: '0789000000001', description: 'PRODUTO A', lineTotal: '15,95', quantityLine: '1 UN X 15,95', unitPrice: '15,95', tax: 'T10' },
  { seq: 5, ean: '0789000000002', description: 'PRODUTO B', lineTotal: '15,95', quantityLine: '1 UN X 15,95', unitPrice: '15,95', tax: 'T10' },
  { seq: 6, ean: '0789000000003', description: 'PRODUTO C', lineTotal: '16,49', quantityLine: '1 UN X 16,49', unitPrice: '16,49', tax: 'T10' },
  { seq: 7, ean: '0789000000004', description: 'PRODUTO D', lineTotal: '25,59', quantityLine: '1 UN X 25,59', unitPrice: '25,59', tax: 'T10' },
  { seq: 8, ean: '0789000000005', description: 'PRODUTO E', lineTotal: '25,59', quantityLine: '1 UN X 25,59', unitPrice: '25,59', tax: 'T10' },
  { seq: 9, ean: '0789000000006', description: 'MUSCULO UR KG', lineTotal: '40,84', quantityLine: '1,104 KG X 36,99', unitPrice: '36,99', tax: 'T10' },
  { seq: 10, ean: '0789000000007', description: 'ALHO CHILENO KG', lineTotal: '5,25', quantityLine: '0,210 KG X 24,99', unitPrice: '24,99', tax: 'T10' },
  { seq: 11, ean: '0789000000008', description: 'BATATA KG', lineTotal: '6,83', quantityLine: '1,180 KG X 5,79', unitPrice: '5,79', tax: 'T10' },
  { seq: 12, ean: '0789000000009', description: 'PRODUTO F', lineTotal: '14,99', quantityLine: '1 UN X 14,99', unitPrice: '14,99', tax: 'T10' },
  { seq: 13, ean: '0789000000010', description: 'PRODUTO G', lineTotal: '8,49', quantityLine: '1 UN X 8,49', unitPrice: '8,49', tax: 'T10' },
  { seq: 14, ean: '0789000000011', description: 'PRODUTO H', lineTotal: '11,39', quantityLine: '1 UN X 11,39', unitPrice: '11,39', tax: 'T10' },
  { seq: 15, ean: '0789000000012', description: 'PRODUTO I', lineTotal: '10,49', quantityLine: '1 UN X 10,49', unitPrice: '10,49', tax: 'T10' },
  { seq: 16, ean: '0789000000013', description: 'MUSSARELA DAVACA LIGHT KG', lineTotal: '10,53', quantityLine: '0,156 KG X 67,49', unitPrice: '67,49', tax: 'T10' },
  { seq: 17, ean: '0789000000014', description: 'MUSSARELA DAVACA LIGHT KG', lineTotal: '12,55', quantityLine: '0,186 KG X 67,49', unitPrice: '67,49', tax: 'T10' },
  { seq: 18, ean: '0789000000015', description: 'PAO FRANCES', lineTotal: '9,34', quantityLine: '0,584 KG X 15,99', unitPrice: '15,99', tax: 'T10' },
  { seq: 19, ean: '0789000000016', description: 'PRODUTO J', lineTotal: '14,99', quantityLine: '1 UN X 14,99', unitPrice: '14,99', tax: 'T10' },
  { seq: 20, ean: '07898422746759', description: 'SAB DOVE 90G', lineTotal: '5,89', quantityLine: '1 UN X 5,89', unitPrice: '5,89', tax: 'T10', discountLine: 'Desconto (VF: 4,89) -1,00' },
  { seq: 21, ean: '07898422746759', description: 'SAB DOVE 90G', lineTotal: '5,89', quantityLine: '1 UN X 5,89', unitPrice: '5,89', tax: 'T10', discountLine: 'Desconto (VF: 4,89) -1,00' },
  { seq: 22, ean: '07898422746759', description: 'SAB DOVE 90G', lineTotal: '5,89', quantityLine: '1 UN X 5,89', unitPrice: '5,89', tax: 'T10', discountLine: 'Desconto (VF: 4,89) -1,00' },
  { seq: 23, ean: '07898422746759', description: 'SAB DOVE 90G', lineTotal: '5,89', quantityLine: '1 UN X 5,89', unitPrice: '5,89', tax: 'T10', discountLine: 'Desconto (VF: 4,89) -1,00' },
  { seq: 24, ean: '0789000000017', description: 'PRODUTO K', lineTotal: '2,59', quantityLine: '1 UN X 2,59', unitPrice: '2,59', tax: 'T10' },
];

function element(text: string, centerX: number, top: number): ReceiptOcrElement {
  const width = Math.max(40, text.length * 7);
  return {
    text,
    frame: {
      left: Math.max(0, centerX - width / 2),
      top,
      right: Math.min(PAGE_WIDTH, centerX + width / 2),
      bottom: top + LINE_HEIGHT,
    },
  };
}

function lineFromElements(elements: ReceiptOcrElement[], top: number): ReceiptOcrLine {
  const sorted = [...elements].sort((a, b) => a.frame.left - b.frame.left);
  return {
    text: sorted.map((entry) => entry.text).join(' '),
    frame: {
      left: sorted[0]?.frame.left ?? 0,
      top,
      right: sorted[sorted.length - 1]?.frame.right ?? PAGE_WIDTH,
      bottom: top + LINE_HEIGHT,
    },
    elements: sorted,
  };
}

export function buildVilaRicaSupermarketDocument(): ReceiptOcrDocument {
  const lines: ReceiptOcrLine[] = [];
  let y = 20;

  lines.push(
    lineFromElements([element('VILA RICA SUPERMERCADOS', 500, y)], y),
  );
  y += 36;

  lines.push(
    lineFromElements([element('DATA 27/07/2026', 120, y)], y),
  );
  y += 28;

  const headerTop = y;
  lines.push(
    lineFromElements(
      [
        element('SQ.CODIGO', COL.seq, headerTop),
        element('DESCRICAO', COL.desc, headerTop),
      ],
      headerTop,
    ),
  );
  lines.push(
    lineFromElements(
      [
        element('QTD', COL.qtd, headerTop + 2),
        element('VL.UNIT', COL.unitPrice, headerTop + 2),
        element('ST', COL.tax, headerTop + 2),
        element('TOTAL', COL.total, headerTop + 2),
      ],
      headerTop + 2,
    ),
  );
  y += 34;

  for (const item of VILA_RICA_ITEMS) {
    const isWeighted = item.quantityLine?.includes('KG X');
    const itemTop = y;

    if (isWeighted) {
      lines.push(
        lineFromElements(
          [
            element(String(item.seq).padStart(2, '0'), COL.seq, itemTop),
            element(item.ean, COL.ean, itemTop),
            element(item.description, COL.desc, itemTop),
          ],
          itemTop,
        ),
      );
      y += LINE_HEIGHT + 4;
      lines.push(
        lineFromElements(
          [
            element(item.quantityLine!, COL.qtd, y),
            element(item.unitPrice!, COL.unitPrice, y),
            element(item.tax ?? 'T10', COL.tax, y),
            element(item.lineTotal, COL.total, y),
          ],
          y,
        ),
      );
      y += LINE_HEIGHT + 6;
    } else {
      lines.push(
        lineFromElements(
          [
            element(String(item.seq).padStart(2, '0'), COL.seq, itemTop),
            element(item.ean, COL.ean, itemTop),
            element(item.description, COL.desc, itemTop),
            element(item.quantityLine!.split(' X ')[0]!, COL.qtd, itemTop),
            element(item.unitPrice!, COL.unitPrice, itemTop),
            element(item.tax ?? 'T10', COL.tax, itemTop),
            element(item.lineTotal, COL.total, itemTop),
          ],
          itemTop,
        ),
      );
      y += LINE_HEIGHT + 6;
    }

    if (item.discountLine) {
      lines.push(lineFromElements([element(item.discountLine, COL.desc, y)], y));
      y += LINE_HEIGHT + 4;
    }
  }

  y += 20;
  lines.push(lineFromElements([element('QTD. TOTAL DE ITENS', 300, y), element('024', 700, y)], y));
  y += LINE_HEIGHT + 6;
  lines.push(lineFromElements([element('VALOR TOTAL (R$)', 300, y)], y));
  lines.push(lineFromElements([element('291,38', 700, y + 2)], y + 2));
  y += LINE_HEIGHT + 10;
  lines.push(lineFromElements([element('Cartao Credito', 300, y), element('291,38', 700, y)], y));

  const pageHeight = y + 40;

  return {
    engine: 'google_mlkit_text_recognition_v2',
    engineVersion: null,
    platform: 'android',
    pages: [
      {
        width: PAGE_WIDTH,
        height: pageHeight,
        blocks: [
          {
            text: lines.map((entry) => entry.text).join('\n'),
            frame: { left: 0, top: 0, right: PAGE_WIDTH, bottom: pageHeight },
            lines,
          },
        ],
      },
    ],
  };
}

export const VILA_RICA_EXPECTED_TOTALS = [
  '799',
  '799',
  '799',
  '1595',
  '1595',
  '1649',
  '2559',
  '2559',
  '4084',
  '525',
  '683',
  '1499',
  '849',
  '1139',
  '1049',
  '1053',
  '1255',
  '934',
  '1499',
  '489',
  '489',
  '489',
  '489',
  '259',
] as const;
