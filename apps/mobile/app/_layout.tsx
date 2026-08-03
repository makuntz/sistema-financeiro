import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/src/providers/auth-provider';
import { AppThemeProvider } from '@/src/providers/theme-provider';
import { useAuth } from '@/src/providers/auth-provider';
import { useSemanticTokens } from '@pp-planning/ui-mobile';

function RootNavigator() {
  const tokens = useSemanticTokens();
  const { themePreference } = useAuth();
  const barStyle =
    themePreference === 'dark' ? 'light' : themePreference === 'light' ? 'dark' : 'auto';

  return (
    <>
      <StatusBar style={barStyle} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.background.default },
          headerTintColor: tokens.text.primary,
          contentStyle: { backgroundColor: tokens.background.default },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </AuthProvider>
  );
}
