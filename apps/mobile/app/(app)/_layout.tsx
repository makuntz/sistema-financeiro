import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/providers/auth-provider';
import { useSemanticTokens } from '@pp-planning/ui-mobile';

export default function AppLayout() {
  const { isBootstrapping, isAuthenticated } = useAuth();
  const tokens = useSemanticTokens();

  if (isBootstrapping) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.background.default,
        }}
      >
        <ActivityIndicator color={tokens.action.primary} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="capturas/camera" options={{ title: 'Escanear nota' }} />
      <Stack.Screen
        name="capturas/[captureId]/processando"
        options={{ title: 'Processando nota' }}
      />
      <Stack.Screen name="capturas/[captureId]/conferir" options={{ title: 'Conferir nota' }} />
      <Stack.Screen name="capturas/[captureId]/itens" options={{ title: 'Itens da nota' }} />
      <Stack.Screen name="capturas/[captureId]/resumo" options={{ title: 'Resumo' }} />
      <Stack.Screen name="lancamentos/novo" options={{ title: 'Novo lançamento' }} />
    </Stack>
  );
}
