import { semanticTokens, primitiveTokens } from './tokens.js';

export const tailwindThemeExtension = {
  colors: {
    background: semanticTokens.background,
    text: semanticTokens.text,
    border: {
      DEFAULT: semanticTokens.border.default,
    },
    action: semanticTokens.action,
    financial: semanticTokens.financial,
  },
  fontFamily: {
    sans: primitiveTokens.fontFamily.sans.split(','),
    display: primitiveTokens.fontFamily.display.split(','),
  },
  borderRadius: {
    sm: `${primitiveTokens.radius.sm}px`,
    md: `${primitiveTokens.radius.md}px`,
    lg: `${primitiveTokens.radius.lg}px`,
  },
} as const;
