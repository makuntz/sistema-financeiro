const DIACRITICS = /[\u0300-\u036f]/g;

export function normalizeOcrText(text: string): string {
  return text.normalize('NFKC').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
}

export function canonicalizeForMatching(text: string): string {
  return normalizeOcrText(text)
    .toUpperCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/\.(?=\s|$)/g, ' ')
    .replace(/[^\w\s,.:/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMoneySymbols(text: string): string {
  return normalizeOcrText(text)
    .replace(/R\$\s*/gi, '')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\.\s*/g, '.');
}

export function stripLeadingItemNumber(text: string): string {
  return normalizeOcrText(text).replace(/^\d{1,2}\s+/, '');
}

export function stripLeadingEan(text: string): string {
  return stripLeadingItemNumber(text).replace(/^\d{8,14}\s+/, '');
}

export function looksLikeEanToken(token: string): boolean {
  return /^\d{8,14}$/.test(token);
}

export function looksLikeItemNumberToken(token: string): boolean {
  return /^\d{1,2}$/.test(token);
}

export function removeItemPrefixTokens(text: string): string {
  let current = normalizeOcrText(text);
  const itemMatch = /^(\d{1,2})\s+(.+)$/.exec(current);
  if (itemMatch) {
    current = itemMatch[2]!;
  }
  const eanMatch = /^(\d{8,14})\s+(.+)$/.exec(current);
  if (eanMatch) {
    current = eanMatch[2]!;
  }
  return current.trim();
}
