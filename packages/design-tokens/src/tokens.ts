export const primitiveTokens = {
  color: {
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate500: '#64748B',
    slate700: '#334155',
    slate900: '#0F172A',
    teal600: '#0D9488',
    teal700: '#0F766E',
    emerald600: '#059669',
    rose600: '#E11D48',
    amber500: '#F59E0B',
    white: '#FFFFFF',
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
    8: 48,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  fontSize: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
  },
  fontFamily: {
    sans: '"Source Sans 3", "Segoe UI", sans-serif',
    display: '"Fraunces", Georgia, serif',
  },
  shadow: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
    md: '0 8px 24px rgba(15, 23, 42, 0.12)',
  },
  breakpoint: {
    sm: 640,
    md: 768,
    lg: 1024,
  },
} as const;

export const semanticTokens = {
  background: {
    default: primitiveTokens.color.slate50,
    subtle: primitiveTokens.color.slate100,
    inverse: primitiveTokens.color.slate900,
  },
  text: {
    primary: primitiveTokens.color.slate900,
    secondary: primitiveTokens.color.slate500,
    inverse: primitiveTokens.color.white,
  },
  border: {
    default: primitiveTokens.color.slate200,
  },
  action: {
    primary: primitiveTokens.color.teal700,
    primaryHover: primitiveTokens.color.teal600,
  },
  financial: {
    income: primitiveTokens.color.emerald600,
    expense: primitiveTokens.color.rose600,
    balance: primitiveTokens.color.slate700,
    warning: primitiveTokens.color.amber500,
    positive: primitiveTokens.color.emerald600,
    negative: primitiveTokens.color.rose600,
  },
} as const;

export type PrimitiveTokens = typeof primitiveTokens;
export type SemanticTokens = typeof semanticTokens;
