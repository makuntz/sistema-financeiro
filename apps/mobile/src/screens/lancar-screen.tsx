import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { ReceiptCaptureSummaryDto } from '@pp-planning/contracts';
import { Button, Card, Screen, Text } from '@pp-planning/ui-mobile';
import { CaptureListItem } from '@/src/components/capture-list-item';
import { apiClient } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export function LancarScreenContent() {
  const { workspace } = useAuth();
  const [captures, setCaptures] = useState<ReceiptCaptureSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCaptures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listReceiptCaptures({ page: 1, pageSize: 5 });
      setCaptures(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar capturas');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCaptures();
    }, [loadCaptures]),
  );

  function openCapture(capture: ReceiptCaptureSummaryDto) {
    if (capture.status === 'processing' || capture.status === 'uploaded') {
      router.push(`/(app)/capturas/${capture.id}/processando`);
      return;
    }
    if (capture.status === 'review') {
      router.push(`/(app)/capturas/${capture.id}/conferir`);
      return;
    }
    router.push(`/(app)/capturas/${capture.id}/resumo`);
  }

  return (
    <Screen scroll padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Text variant="eyebrow">Lançar</Text>
        <Text variant="title">O que deseja registrar?</Text>
        {workspace ? <Text tone="secondary">Workspace: {workspace.workspace.name}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button label="Escanear nota" onPress={() => router.push('/(app)/capturas/camera')} />
        <View style={styles.secondaryRow}>
          <Button
            label="Despesa manual"
            variant="secondary"
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/lancamentos/novo?tipo=expense')}
          />
          <Button
            label="Receita manual"
            variant="secondary"
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/lancamentos/novo?tipo=income')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle">Capturas recentes</Text>
        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : error ? (
          <Card>
            <Text tone="danger">{error}</Text>
            <Button
              label="Tentar novamente"
              variant="secondary"
              onPress={() => void loadCaptures()}
            />
          </Card>
        ) : captures.length === 0 ? (
          <Card>
            <Text tone="secondary">Nenhuma captura recente. Escaneie sua primeira nota.</Text>
          </Card>
        ) : (
          <FlatList
            data={captures}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <CaptureListItem capture={item} onPress={() => openCapture(item)} />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    padding: 16,
    gap: 8,
  },
  actions: {
    paddingHorizontal: 16,
    gap: 12,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
  },
  section: {
    padding: 16,
    gap: 12,
  },
  loader: {
    marginTop: 16,
  },
});
