import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatCentsToBRL } from '@pp-planning/contracts';
import { Button, Input, MoneyDigitPad, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient } from '@/src/lib/api';
import { useCategories } from '@/src/hooks/use-categories';
import { useReceiptCapture } from '@/src/hooks/use-receipt-capture';

export default function ConferirScreen() {
  const { captureId } = useLocalSearchParams<{ captureId: string }>();
  const { capture, loading, error, reload } = useReceiptCapture(captureId);
  const { categories } = useCategories('expense');
  const [merchantName, setMerchantName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [totalInCents, setTotalInCents] = useState('0');
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!capture || initialized) {
      return;
    }
    setMerchantName(capture.merchantName ?? '');
    setPurchaseDate(capture.purchaseDate ?? '');
    setTotalInCents(capture.totalAmountInCents ?? '0');
    setDefaultCategoryId(capture.defaultCategoryId);
    setInitialized(true);
  }, [capture, initialized]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories],
  );

  const reviewCount = useMemo(
    () => (capture?.items ?? []).filter((item) => item.needsReview && !item.isIgnored).length,
    [capture?.items],
  );

  const previewTotalInCents = useMemo(() => {
    if (totalInCents === '0') {
      return null;
    }
    return totalInCents;
  }, [totalInCents]);

  const previewDifferenceInCents = useMemo(() => {
    if (!capture || previewTotalInCents == null) {
      return null;
    }
    return BigInt(previewTotalInCents) - BigInt(capture.itemsTotalInCents);
  }, [capture, previewTotalInCents]);

  const differenceLabel = useMemo(() => {
    if (previewDifferenceInCents == null) {
      return null;
    }
    return formatCentsToBRL(previewDifferenceInCents.toString());
  }, [previewDifferenceInCents]);

  async function handleSave() {
    if (!captureId) {
      return;
    }
    if (totalInCents === '0') {
      setSaveError('Informe o total da nota antes de continuar.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.updateReceiptCapture(captureId, {
        merchantName: merchantName.trim() || null,
        purchaseDate: purchaseDate.trim() || null,
        totalAmountInCents: totalInCents,
        defaultCategoryId,
      });
      router.push(`/(app)/capturas/${captureId}/itens`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar conferência');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !capture) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">Conferir nota</Text>
      <Text tone="secondary">Revise os dados extraídos antes de classificar os itens.</Text>

      {capture ? (
        <View style={styles.summaryBox}>
          <Text>{capture.itemCount} itens encontrados</Text>
          <Text>{reviewCount} precisam de revisão</Text>
          <Text>
            Total da nota:{' '}
            {formatCentsToBRL(previewTotalInCents ?? capture.totalAmountInCents ?? '0')}
          </Text>
          <Text>Soma dos itens: {formatCentsToBRL(capture.itemsTotalInCents)}</Text>
          {differenceLabel != null ? (
            <Text tone={previewDifferenceInCents === 0n ? 'success' : 'danger'}>
              Diferença: {differenceLabel}
            </Text>
          ) : (
            <Text tone="secondary">Informe o total da nota para ver a diferença</Text>
          )}
        </View>
      ) : null}

      {error ? <Text tone="danger">{error}</Text> : null}
      {saveError ? <Text tone="danger">{saveError}</Text> : null}

      <Input
        label="Estabelecimento"
        value={merchantName}
        onChangeText={setMerchantName}
        autoCorrect={false}
      />
      <Input
        label="Data da compra (AAAA-MM-DD)"
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />

      {!capture?.totalAmountInCents ? (
        <Text tone="secondary">
          O total não foi detectado automaticamente. Use o teclado numérico abaixo (29138 → R$ 291,38).
        </Text>
      ) : null}

      <MoneyDigitPad label="Total da nota" cents={totalInCents} onChangeCents={setTotalInCents} />

      <View style={styles.section}>
        <Text variant="subtitle">Categoria padrão</Text>
        {expenseCategories.map((category) => {
          const selected = category.id === defaultCategoryId;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              onPress={() => setDefaultCategoryId(category.id)}
              style={[styles.categoryRow, selected && styles.categorySelected]}
            >
              <Text>{category.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        label={saving ? 'Salvando...' : 'Continuar para itens'}
        disabled={saving}
        onPress={() => void handleSave()}
      />
      <Button label="Atualizar" variant="secondary" onPress={() => void reload()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryBox: {
    gap: 4,
    paddingVertical: 8,
  },
  section: {
    gap: 8,
  },
  categoryRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  categorySelected: {
    borderWidth: 2,
  },
});
