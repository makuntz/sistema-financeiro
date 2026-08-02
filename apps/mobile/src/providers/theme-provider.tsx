import { useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkSemanticTokens,
  lightSemanticTokens,
  type SemanticTokens,
} from '@pp-planning/design-tokens';
import { ThemeProvider as UiThemeProvider } from '@pp-planning/ui-mobile';
import { useAuth, type ThemePreference } from '@/src/providers/auth-provider';

function resolveTokens(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null,
): SemanticTokens {
  if (preference === 'dark') {
    return darkSemanticTokens;
  }
  if (preference === 'light') {
    return lightSemanticTokens;
  }
  return systemScheme === 'dark' ? darkSemanticTokens : lightSemanticTokens;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { themePreference } = useAuth();
  const systemScheme = useColorScheme();
  const tokens = useMemo(
    () => resolveTokens(themePreference, systemScheme ?? 'light'),
    [themePreference, systemScheme],
  );

  return <UiThemeProvider tokens={tokens}>{children}</UiThemeProvider>;
}
