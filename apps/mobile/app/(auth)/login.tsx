import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Input, Screen, Text } from '@pp-planning/ui-mobile';
import { useAuth } from '@/src/providers/auth-provider';
import { getDevAutoLoginCredentials, isDevAutoLoginEnabled } from '@/src/lib/utils';

export default function LoginScreen() {
  const { login } = useAuth();
  const defaults = isDevAutoLoginEnabled() ? getDevAutoLoginCredentials() : null;
  const [email, setEmail] = useState(defaults?.email ?? '');
  const [password, setPassword] = useState(defaults?.password ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/(app)/(tabs)/lancar');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível entrar';
      const unreachable =
        message.includes('Network') ||
        message.includes('Failed to fetch') ||
        message.includes('Network request failed');
      setError(
        unreachable
          ? 'Não foi possível conectar à API. Confirme se `pnpm dev:api` está rodando.'
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="eyebrow">PP Planning</Text>
      <Text variant="title">Entrar</Text>
      <Text tone="secondary">Acesse sua conta para lançar despesas e escanear notas.</Text>

      <Input
        label="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Input label="Senha" secureTextEntry value={password} onChangeText={setPassword} />

      {error ? <Text tone="danger">{error}</Text> : null}

      <Button
        label={loading ? 'Entrando...' : 'Entrar'}
        disabled={loading}
        onPress={() => void handleLogin()}
      />

      <View style={styles.footer}>
        <Text tone="secondary">Ainda não tem conta?</Text>
        <Link href="/(auth)/cadastro">
          <Text style={styles.link}>Criar conta</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  link: {
    fontWeight: '700',
  },
});
