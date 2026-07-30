import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@pp-planning/ui-mobile';
import { semanticTokens } from '@pp-planning/design-tokens';
import type { HealthStatus } from '@pp-planning/contracts';
import { apiClient, apiUrl } from '../src/lib/api';

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthStatus }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const environment = process.env.NODE_ENV ?? 'development';

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await apiClient.health();
        if (!cancelled) {
          setHealth({ status: 'ok', data });
        }
      } catch (error) {
        if (!cancelled) {
          setHealth({
            status: 'error',
            message: error instanceof Error ? error.message : 'Falha ao consultar a API',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Diagnóstico</Text>
        <Text style={styles.title}>PP Planning</Text>
        <Text style={styles.subtitle}>
          Fundação do aplicativo mobile. Autenticação e câmera serão adicionadas em etapas
          posteriores.
        </Text>

        <Card title="Status do sistema">
          <View style={styles.row}>
            <Text style={styles.label}>Ambiente</Text>
            <Text style={styles.value}>{environment}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>API URL</Text>
            <Text style={styles.value}>{apiUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>API</Text>
            {health.status === 'loading' ? (
              <ActivityIndicator color={semanticTokens.action.primary} />
            ) : health.status === 'ok' ? (
              <Text style={[styles.value, { color: semanticTokens.financial.income }]}>
                {health.data.status} · v{health.data.version}
              </Text>
            ) : (
              <Text style={[styles.value, { color: semanticTokens.financial.expense }]}>
                {health.message}
              </Text>
            )}
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: semanticTokens.background.default,
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: 'center',
  },
  eyebrow: {
    color: semanticTokens.action.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: semanticTokens.text.primary,
  },
  subtitle: {
    color: semanticTokens.text.secondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  label: {
    color: semanticTokens.text.secondary,
  },
  value: {
    color: semanticTokens.text.primary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
});
