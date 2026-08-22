import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Input, MoneyInput, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient } from '@/src/lib/api';
import { useReceiptCapture } from '@/src/hooks/use-receipt-capture';

export default function EditItemScreen() {
  const { captureId, itemId } = useLocalSearchParams<{ captureId: string; itemId: string }>();
  const { capture, loading, error, reload } = useReceiptCapture(captureId);
  const item = capture?.items.find((entry) => entry.id === itemId);
  const [rawDescription, setRawDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [unitPriceInCents, setUnitPriceInCents] = useState('0');
  const [lineTotalInCents, setLineTotalInCents] = useState('0');
  const [needsReview, setNeedsReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!item || initialized) {
      return;
    }
    setRawDescription(item.rawDescription);
    setQuantity(item.quantity ?? '');
    setUnitOfMeasure(item.unitOfMeasure ?? '');
    setUnitPriceInCents(item.unitPriceInCents ?? '0');
    setLineTotalInCents(item.lineTotalInCents ?? '0');
    setNeedsReview(item.needsReview);
    setInitialized(true);
  }, [item, initialized]);

  async function handleSave() {
    if (!captureId || !itemId) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.updateReceiptItem(captureId, itemId, {
        rawDescription: rawDescription.trim(),
        quantity: quantity.trim() || null,
        unitOfMeasure: unitOfMeasure.trim() || null,
        unitPriceInCents: unitPriceInCents === '0' ? null : unitPriceInCents,
        lineTotalInCents: lineTotalInCents === '0' ? null : lineTotalInCents,
        needsReview,
      });
      await reload();
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar item');
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

  if (!item) {
    return (
      <Screen scroll>
        <Text variant="title">Item não encontrado</Text>
        {error ? <Text tone="danger">{error}</Text> : null}
        <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">Editar item</Text>
      {saveError ? <Text tone="danger">{saveError}</Text> : null}
      <Input label="Descrição" value={rawDescription} onChangeText={setRawDescription} />
      <Input label="Quantidade" value={quantity} onChangeText={setQuantity} />
      <Input label="Unidade" value={unitOfMeasure} onChangeText={setUnitOfMeasure} />
      <MoneyInput
        label="Preço unitário"
        cents={unitPriceInCents}
        onChangeCents={setUnitPriceInCents}
      />
      <MoneyInput label="Valor" cents={lineTotalInCents} onChangeCents={setLineTotalInCents} />
      <Button
        label={needsReview ? 'Marcar como revisado' : 'Marcar para revisão'}
        variant="secondary"
        onPress={() => setNeedsReview((current) => !current)}
      />
      <Button label={saving ? 'Salvando...' : 'Salvar'} disabled={saving} onPress={() => void handleSave()} />
      <Button label="Cancelar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({});
