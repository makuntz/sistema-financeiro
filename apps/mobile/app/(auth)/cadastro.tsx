import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Input, Screen, Text } from '@pp-planning/ui-mobile';
import { useAuth } from '@/src/providers/auth-provider';

export default function CadastroScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(app)/(tabs)/lancar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="eyebrow">PP Planning</Text>
      <Text variant="title">Criar conta</Text>
      <Text tone="secondary">Cadastre-se para começar a organizar suas finanças.</Text>

      <Input label="Nome" value={name} onChangeText={setName} />
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
        label={loading ? 'Criando...' : 'Criar conta'}
        disabled={loading}
        onPress={() => void handleRegister()}
      />

      <View style={styles.footer}>
        <Text tone="secondary">Já tem conta?</Text>
        <Link href="/(auth)/login">
          <Text style={styles.link}>Entrar</Text>
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
