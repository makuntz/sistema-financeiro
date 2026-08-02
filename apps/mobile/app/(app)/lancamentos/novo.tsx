import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Input, MoneyInput, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient } from '@/src/lib/api';
import { todayDateOnly } from '@/src/lib/utils';
import { flattenSubcategories, useCategories } from '@/src/hooks/use-categories';

export default function NovoLancamentoScreen() {
  const params = useLocalSearchParams<{ tipo?: string }>();
  const kind = params.tipo === 'income' ? 'income' : 'expense';
  const { categories, loading } = useCategories(kind);
  const subcategories = useMemo(() => flattenSubcategories(categories), [categories]);

  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [amountInCents, setAmountInCents] = useState('0');
  const [occurredOn, setOccurredOn] = useState(todayDateOnly());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!subcategoryId) {
      setError('Selecione uma subcategoria');
      return;
    }
    if (!description.trim()) {
      setError('Informe uma descrição');
      return;
    }
    if (amountInCents === '0') {
      setError('Informe um valor');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient.createLedgerEntry({
        subcategoryId,
        description: description.trim(),
        notes: notes.trim() || undefined,
        amountInCents,
        occurredOn,
      });
      router.replace('/(app)/(tabs)/lancar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lançamento');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">{kind === 'income' ? 'Nova receita' : 'Nova despesa'}</Text>
      <Text tone="secondary">Lançamento manual no ledger.</Text>

      {error ? <Text tone="danger">{error}</Text> : null}

      <View style={styles.section}>
        <Text variant="subtitle">Subcategoria</Text>
        {subcategories.map((sub) => {
          const selected = sub.id === subcategoryId;
          return (
            <Pressable
              key={sub.id}
              accessibilityRole="button"
              onPress={() => setSubcategoryId(sub.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text>{sub.name}</Text>
              <Text tone="secondary" variant="caption">
                {sub.categoryName}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input label="Descrição" value={description} onChangeText={setDescription} />
      <Input label="Observações" value={notes} onChangeText={setNotes} />
      <Input
        label="Data (AAAA-MM-DD)"
        value={occurredOn}
        onChangeText={setOccurredOn}
        autoCapitalize="none"
      />
      <MoneyInput label="Valor" cents={amountInCents} onChangeCents={setAmountInCents} />

      <Button
        label={saving ? 'Salvando...' : 'Salvar lançamento'}
        disabled={saving}
        onPress={() => void handleSave()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
  optionSelected: {
    borderWidth: 2,
  },
});
