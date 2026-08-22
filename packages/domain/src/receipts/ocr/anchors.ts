export const MERCHANT_SKIP_ANCHORS = [
  'CNPJ',
  'CPF',
  'RUA',
  'AV ',
  'AV.',
  'AVENIDA',
  'CEP',
  'FONE',
  'TELEFONE',
  'IE',
  'IM',
  'DOCUMENTO AUXILIAR',
  'NFCE',
  'NFC-E',
  'DANFE',
  'NOTA FISCAL',
  'CONSUMIDOR',
] as const;

export const ITEM_HEADER_ANCHORS = [
  'DESCRICAO',
  'DESCRIÇÃO',
  'COD DESCRICAO',
  'COD DESCR',
  'CODIGO DESCRICAO',
  'ITEM CODIGO DESCRICAO',
  'QTD VL UNIT',
  'QTD VL UNIT ST TOTAL',
  'QTD VL UNIT VL TOTAL',
] as const;

export const ITEM_REGION_END_ANCHORS = [
  'QTD TOTAL DE ITENS',
  'QTDE TOTAL DE ITENS',
  'QTD. TOTAL DE ITENS',
  'VALOR TOTAL',
] as const;

export const ITEM_FOOTER_ANCHORS = [
  ...ITEM_REGION_END_ANCHORS,
  'TOTAL R$',
  'TOTAL DA COMPRA',
  'TOTAL A PAGAR',
  'VALOR A PAGAR',
  'FORMA DE PAGAMENTO',
  'PAGAMENTO',
  'VALOR PAGO',
  'TROCO',
  'TRIBUTOS',
  'CONSUMIDOR',
  'CHAVE DE ACESSO',
  'PROTOCOLO',
  'CONSULTE',
  'QR CODE',
  'CARTAO',
  'CARTÃO',
  'DEBITO',
  'DÉBITO',
  'CREDITO',
  'CRÉDITO',
  'PIX',
  'DINHEIRO',
] as const;

export const TOTAL_POSITIVE_ANCHORS = [
  'VALOR TOTAL',
  'TOTAL R$',
  'TOTAL DA COMPRA',
  'TOTAL A PAGAR',
  'VALOR A PAGAR',
] as const;

export const TOTAL_NEGATIVE_ANCHORS = [
  'SUBTOTAL',
  'VALOR PAGO',
  'DINHEIRO',
  'CARTAO',
  'CARTÃO',
  'TROCO',
  'TRIBUTOS',
  'DESCONTO',
  'QTD TOTAL',
  'QTDE TOTAL',
] as const;

export const PAYMENT_ANCHORS = [
  'CARTAO',
  'CARTÃO',
  'DEBITO',
  'DÉBITO',
  'CREDITO',
  'CRÉDITO',
  'PIX',
  'DINHEIRO',
  'VALOR PAGO',
  'TROCO',
] as const;

export const UNIT_OF_MEASURE_TOKENS = ['UN', 'UND', 'UNID', 'KG', 'G', 'L', 'ML', 'LT', 'PC', 'PCT', 'CX'] as const;

export const DISCOUNT_LINE_PATTERN = /desconto|descorto|descont|\(VF\s*:/i;

export const QTY_TIMES_UNIT_PATTERN =
  /^(\d+[.,]?\d*|\d+)\s*(UN|UND|UNID|KG|G|L|ML|LT|PC|PCT|CX)\s*[xX]?\s*(\d[\d.,]*)/i;

/** NFC-e item lines usually start with sequence + barcode or product name. */
export const ITEM_ROW_START_PATTERN = /^\d{1,2}\s+(?:(?:\d{8,14}\s+)?[A-ZÀ-ÿ]{3,})/;

/** Some OCR outputs drop the item sequence and keep only the EAN + description. */
export const ITEM_ROW_EAN_START_PATTERN = /^\d{8,14}\s+[A-ZÀ-ÿ]{3,}/;

export const WEIGHTED_LINE_PATTERN =
  /(\d+[.,]\d+|\d+)\s*(KG|G|UN|UND|UNID|L|ML|LT|PC|PCT|CX)\s*[xX]\s*(?:R\$\s*)?(\d[\d.,]*)/i;

export const QUANTITY_UNIT_PATTERN = /(\d+[.,]\d+|\d+)\s*(UN|UND|UNID|KG|G|L|ML|LT|PC|PCT|CX)\b/i;
