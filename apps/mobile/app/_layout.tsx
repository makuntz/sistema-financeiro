import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { semanticTokens } from '@pp-planning/design-tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: semanticTokens.background.default },
          headerTintColor: semanticTokens.text.primary,
          contentStyle: { backgroundColor: semanticTokens.background.default },
          title: 'PP Planning',
        }}
      />
    </>
  );
}
