import { createContext, useContext, type ReactNode } from 'react';
import { lightSemanticTokens, type SemanticTokens } from '@pp-planning/design-tokens';

const ThemeContext = createContext<SemanticTokens>(lightSemanticTokens);

export type ThemeProviderProps = {
  tokens: SemanticTokens;
  children: ReactNode;
};

export function ThemeProvider({ tokens, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useSemanticTokens(): SemanticTokens {
  return useContext(ThemeContext);
}
