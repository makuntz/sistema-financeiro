export const primitiveTokens = {
  color: {
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate300: '#CBD5E1',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1E293B',
    slate900: '#0F172A',
    slate950: '#020617',
    blue500: '#3B82F6',
    blue600: '#2563EB',
    blue700: '#1D4ED8',
    navy900: '#0B1220',
    navy950: '#070B14',
    emerald500: '#10B981',
    emerald600: '#059669',
    rose500: '#F43F5E',
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
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
  },
  fontSize: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
  },
  fontFamily: {
    sans: '"Source Sans 3", "Segoe UI", sans-serif',
    display: '"Source Sans 3", "Segoe UI", sans-serif',
  },
  shadow: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 8px 24px rgba(15, 23, 42, 0.10)',
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
    inverse: primitiveTokens.color.navy900,
  },
  surface: {
    default: primitiveTokens.color.white,
    elevated: primitiveTokens.color.white,
    muted: primitiveTokens.color.slate100,
  },
  text: {
    primary: primitiveTokens.color.slate900,
    secondary: primitiveTokens.color.slate500,
    inverse: primitiveTokens.color.white,
  },
  border: {
    default: primitiveTokens.color.slate200,
    strong: primitiveTokens.color.slate300,
  },
  action: {
    primary: primitiveTokens.color.blue600,
    primaryHover: primitiveTokens.color.blue700,
  },
  financial: {
    income: primitiveTokens.color.emerald600,
    expense: primitiveTokens.color.rose600,
    balance: primitiveTokens.color.blue600,
    warning: primitiveTokens.color.amber500,
    positive: primitiveTokens.color.emerald600,
    negative: primitiveTokens.color.rose600,
  },
  status: {
    success: primitiveTokens.color.emerald600,
    warning: primitiveTokens.color.amber500,
    danger: primitiveTokens.color.rose600,
  },
  nav: {
    background: primitiveTokens.color.navy900,
    backgroundHover: 'rgba(59, 130, 246, 0.16)',
    active: primitiveTokens.color.blue600,
    text: 'rgba(255, 255, 255, 0.92)',
    textMuted: 'rgba(255, 255, 255, 0.55)',
  },
} as const;

export type PrimitiveTokens = typeof primitiveTokens;
export type SemanticTokens = typeof semanticTokens;
