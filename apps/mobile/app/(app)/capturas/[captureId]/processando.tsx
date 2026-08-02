import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient } from '@/src/lib/api';
import { getPollingDelayMs } from '@/src/lib/utils';

export default function ProcessandoScreen() {
  const { captureId } = useLocalSearchParams<{ captureId: string }>();
  const attemptRef = useRef(0);
  const [message, setMessage] = useState('Enviando nota para processamento...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (!captureId || cancelled) {
        return;
      }

      try {
        const capture = await apiClient.getReceiptCapture(captureId);
        if (cancelled) {
          return;
        }

        if (capture.status === 'review') {
          router.replace(`/(app)/capturas/${captureId}/conferir`);
          return;
        }

        if (capture.status === 'failed') {
          setError(capture.failureMessage ?? 'Não foi possível processar a nota.');
          return;
        }

        if (capture.status === 'confirmed') {
          router.replace(`/(app)/capturas/${captureId}/resumo`);
          return;
        }

        setMessage('Extraindo itens da nota...');
        const delay = getPollingDelayMs(attemptRef.current);
        attemptRef.current += 1;
        timeoutId = setTimeout(() => {
          void poll();
        }, delay);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao acompanhar processamento');
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [captureId]);

  return (
    <Screen scroll>
      <Text variant="title">Processando</Text>
      <Text tone="secondary">{message}</Text>

      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>

      {error ? <Text tone="danger">{error}</Text> : null}

      <Button
        label="Continuar depois"
        variant="secondary"
        onPress={() => router.replace('/(app)/(tabs)/lancar')}
      />
      {error ? (
        <Button
          label="Tentar reprocessar"
          onPress={() => {
            if (!captureId) {
              return;
            }
            setError(null);
            void apiClient.reprocessReceiptCapture(captureId);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
