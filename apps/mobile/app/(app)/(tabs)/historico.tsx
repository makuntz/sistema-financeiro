import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { ReceiptCaptureSummaryDto } from '@pp-planning/contracts';
import { Card, Screen, Text } from '@pp-planning/ui-mobile';
import { CaptureListItem } from '@/src/components/capture-list-item';
import { apiClient } from '@/src/lib/api';

export default function HistoricoScreen() {
  const [captures, setCaptures] = useState<ReceiptCaptureSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCaptures = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await apiClient.listReceiptCaptures({ page: 1, pageSize: 30 });
      setCaptures(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCaptures();
    }, [loadCaptures]),
  );

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Text variant="title">Histórico</Text>
        <Text tone="secondary">Capturas de notas fiscais do workspace.</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : error ? (
        <View style={styles.content}>
          <Card>
            <Text tone="danger">{error}</Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={captures}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadCaptures(true)} />
          }
          ListEmptyComponent={
            <Card>
              <Text tone="secondary">Nenhuma captura encontrada.</Text>
            </Card>
          }
          renderItem={({ item }) => (
            <CaptureListItem
              capture={item}
              onPress={() => {
                if (item.status === 'review') {
                  router.push(`/(app)/capturas/${item.id}/conferir`);
                } else if (item.status === 'processing' || item.status === 'uploaded') {
                  router.push(`/(app)/capturas/${item.id}/processando`);
                } else {
                  router.push(`/(app)/capturas/${item.id}/resumo`);
                }
              }}
            />
          )}
        />
      )}
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
  content: {
    padding: 16,
    gap: 8,
  },
  loader: {
    marginTop: 32,
  },
});
