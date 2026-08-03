import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatCentsToBRL } from '@pp-planning/contracts';
import { Button, Card, MoneyDisplay, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient } from '@/src/lib/api';
import { useReceiptCapture } from '@/src/hooks/use-receipt-capture';

export default function ResumoScreen() {
  const { captureId } = useLocalSearchParams<{ captureId: string }>();
  const { capture, loading, error, reload } = useReceiptCapture(captureId);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        subcategoryName: string;
        categoryName: string;
        amountInCents: bigint;
        itemCount: number;
      }
    >();

    for (const item of capture?.items ?? []) {
      if (item.isIgnored || !item.selectedSubcategoryId || !item.lineTotalInCents) {
        continue;
      }
      const key = item.selectedSubcategoryId;
      const current = map.get(key) ?? {
        subcategoryName: item.selectedSubcategoryName ?? 'Subcategoria',
        categoryName: item.selectedCategoryName ?? 'Categoria',
        amountInCents: 0n,
        itemCount: 0,
      };
      current.amountInCents += BigInt(item.lineTotalInCents);
      current.itemCount += 1;
      map.set(key, current);
    }

    return [...map.values()];
  }, [capture?.items]);

  async function handleConfirm() {
    if (!captureId) {
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      const result = await apiClient.confirmReceiptCapture(captureId, {});
      setSuccessMessage(`Confirmado com ${result.ledgerEntryIds.length} lançamento(s) criado(s).`);
      await reload();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Erro ao confirmar captura');
    } finally {
      setConfirming(false);
    }
  }

  if (loading && !capture) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  const totalDifference = capture ? BigInt(capture.totalDifferenceInCents) : 0n;

  return (
    <Screen scroll>
      <Text variant="title">Resumo</Text>
      <Text tone="secondary">{capture?.merchantName ?? 'Nota fiscal'}</Text>

      {error ? <Text tone="danger">{error}</Text> : null}
      {confirmError ? <Text tone="danger">{confirmError}</Text> : null}
      {successMessage ? <Text tone="success">{successMessage}</Text> : null}

      <Card title="Totais">
        <View style={styles.row}>
          <Text tone="secondary">Total da nota</Text>
          {capture?.totalAmountInCents ? (
            <MoneyDisplay cents={capture.totalAmountInCents} tone="expense" />
          ) : (
            <Text tone="secondary">—</Text>
          )}
        </View>
        <View style={styles.row}>
          <Text tone="secondary">Soma dos itens</Text>
          <MoneyDisplay cents={capture?.itemsTotalInCents ?? '0'} tone="expense" />
        </View>
        <View style={styles.row}>
          <Text tone="secondary">Diferença</Text>
          <Text tone={totalDifference === 0n ? 'success' : 'danger'}>
            {formatCentsToBRL(totalDifference.toString())}
          </Text>
        </View>
      </Card>

      <Card title="Por subcategoria">
        {groups.length === 0 ? (
          <Text tone="secondary">Nenhum item classificado para resumir.</Text>
        ) : (
          groups.map((group) => (
            <View key={`${group.categoryName}-${group.subcategoryName}`} style={styles.groupRow}>
              <View style={styles.groupMeta}>
                <Text>{group.subcategoryName}</Text>
                <Text tone="secondary" variant="caption">
                  {group.categoryName} · {group.itemCount} item(ns)
                </Text>
              </View>
              <MoneyDisplay cents={group.amountInCents.toString()} tone="expense" />
            </View>
          ))
        )}
      </Card>

      {capture?.status === 'review' ? (
        <>
          <Button
            label="Ajustar itens"
            variant="secondary"
            onPress={() => router.push(`/(app)/capturas/${captureId}/itens`)}
          />
          <Button
            label={confirming ? 'Confirmando...' : 'Confirmar e lançar'}
            disabled={confirming}
            onPress={() => void handleConfirm()}
          />
        </>
      ) : (
        <Button
          label="Voltar ao início"
          variant="secondary"
          onPress={() => router.replace('/(app)/(tabs)/lancar')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  groupMeta: {
    flex: 1,
    gap: 2,
  },
});
