import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import type { ReceiptItemDto } from '@pp-planning/contracts';
import { formatCentsToBRL } from '@pp-planning/contracts';
import {
  Button,
  Input,
  MoneyDisplay,
  MoneyInput,
  Screen,
  Text,
  useSemanticTokens,
} from '@pp-planning/ui-mobile';
import { SubcategoryPicker } from '@/src/components/subcategory-picker';
import { apiClient } from '@/src/lib/api';
import { useCategories } from '@/src/hooks/use-categories';
import { useReceiptCapture } from '@/src/hooks/use-receipt-capture';

type ItemFilter = 'all' | 'review' | 'pending' | 'classified' | 'ignored';

export default function ItensScreen() {
  const { captureId } = useLocalSearchParams<{ captureId: string }>();
  const tokens = useSemanticTokens();
  const { capture, loading, error, reload } = useReceiptCapture(captureId);
  const { categories } = useCategories('expense');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [recentSubcategoryIds, setRecentSubcategoryIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('0');
  const [newLineTotal, setNewLineTotal] = useState('0');

  const filteredItems = useMemo(() => {
    const items = capture?.items ?? [];
    switch (filter) {
      case 'review':
        return items.filter((item) => item.needsReview && !item.isIgnored);
      case 'pending':
        return items.filter((item) => !item.isIgnored && !item.selectedSubcategoryId);
      case 'classified':
        return items.filter((item) => Boolean(item.selectedSubcategoryId));
      case 'ignored':
        return items.filter((item) => item.isIgnored);
      default:
        return items;
    }
  }, [capture?.items, filter]);

  function toggleSelection(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  async function bulkAssign(subcategoryId: string) {
    if (!captureId || selectedIds.length === 0) {
      return;
    }
    setWorking(true);
    setActionError(null);
    try {
      await apiClient.bulkAssignReceiptItems(captureId, {
        itemIds: selectedIds,
        subcategoryId,
      });
      setRecentSubcategoryIds((current) =>
        [subcategoryId, ...current.filter((id) => id !== subcategoryId)].slice(0, 5),
      );
      setSelectedIds([]);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao classificar itens');
    } finally {
      setWorking(false);
    }
  }

  async function bulkIgnore() {
    if (!captureId || selectedIds.length === 0) {
      return;
    }
    setWorking(true);
    setActionError(null);
    try {
      await apiClient.bulkIgnoreReceiptItems(captureId, { itemIds: selectedIds });
      setSelectedIds([]);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao ignorar itens');
    } finally {
      setWorking(false);
    }
  }

  async function handleAddItem() {
    if (!captureId || !newDescription.trim()) {
      return;
    }
    setWorking(true);
    setActionError(null);
    try {
      await apiClient.createReceiptItem(captureId, {
        rawDescription: newDescription.trim(),
        quantity: newQuantity.trim() || null,
        unitOfMeasure: newUnit.trim() || null,
        unitPriceInCents: newUnitPrice === '0' ? null : newUnitPrice,
        lineTotalInCents: newLineTotal === '0' ? null : newLineTotal,
      });
      setAddVisible(false);
      setNewDescription('');
      setNewQuantity('');
      setNewUnit('');
      setNewUnitPrice('0');
      setNewLineTotal('0');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao adicionar item');
    } finally {
      setWorking(false);
    }
  }

  function renderQuantity(item: ReceiptItemDto): string | null {
    if (!item.quantity) {
      return null;
    }
    const unit = item.unitOfMeasure ? ` ${item.unitOfMeasure.toLowerCase()}` : '';
    return `${item.quantity}${unit}`;
  }

  function renderItem({ item }: { item: ReceiptItemDto }) {
    const selected = selectedIds.includes(item.id);
    const quantityLabel = renderQuantity(item);

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => toggleSelection(item.id)}
        onLongPress={() =>
          router.push(`/(app)/capturas/${captureId}/itens/${item.id}` as Href)
        }
        style={[
          styles.itemRow,
          {
            borderColor: selected ? tokens.action.primary : tokens.border.default,
            backgroundColor: tokens.surface.default,
          },
        ]}
      >
        <View style={styles.itemMeta}>
          <Text>{item.rawDescription}</Text>
          {quantityLabel ? (
            <Text tone="secondary" variant="caption">
              Quantidade: {quantityLabel}
            </Text>
          ) : null}
          {item.unitPriceInCents ? (
            <Text tone="secondary" variant="caption">
              Preço unitário: {formatCentsToBRL(item.unitPriceInCents)}
              {item.unitOfMeasure ? `/${item.unitOfMeasure.toLowerCase()}` : ''}
            </Text>
          ) : null}
          <Text tone="secondary" variant="caption">
            {item.isIgnored
              ? 'Ignorado'
              : item.selectedSubcategoryName
                ? `${item.selectedCategoryName} · ${item.selectedSubcategoryName}`
                : 'Subcategoria: Pendente'}
          </Text>
          {item.needsReview && !item.isIgnored ? (
            <Text tone="danger" variant="caption">
              Revisar
            </Text>
          ) : null}
        </View>
        {item.lineTotalInCents ? (
          <MoneyDisplay cents={item.lineTotalInCents} tone="expense" />
        ) : (
          <Text tone="danger" variant="caption">
            Sem valor
          </Text>
        )}
      </Pressable>
    );
  }

  if (loading && !capture) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Text variant="title">Itens</Text>
        <Text tone="secondary">
          {capture?.classifiedItemCount ?? 0} classificados · {capture?.ignoredItemCount ?? 0}{' '}
          ignorados · diferença {formatCentsToBRL(capture?.totalDifferenceInCents ?? '0')}
        </Text>
        {error ? <Text tone="danger">{error}</Text> : null}
        {actionError ? <Text tone="danger">{actionError}</Text> : null}

        <View style={styles.filters}>
          {(['all', 'review', 'pending', 'classified', 'ignored'] as ItemFilter[]).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setFilter(value)}
              style={[
                styles.filterChip,
                {
                  borderColor: filter === value ? tokens.action.primary : tokens.border.default,
                },
              ]}
            >
              <Text variant="caption">
                {value === 'all'
                  ? 'Todos'
                  : value === 'review'
                    ? 'Revisar'
                    : value === 'pending'
                      ? 'Pendentes'
                      : value === 'classified'
                        ? 'Classificados'
                        : 'Ignorados'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={<Text tone="secondary">Nenhum item neste filtro.</Text>}
      />

      <View style={styles.footer}>
        <Text tone="secondary" variant="caption">
          {selectedIds.length} selecionado(s) · pressione e segure para editar
        </Text>
        <Button label="Adicionar item" variant="secondary" onPress={() => setAddVisible(true)} />
        <Button
          label="Classificar selecionados"
          disabled={selectedIds.length === 0 || working}
          onPress={() => setPickerVisible(true)}
        />
        <Button
          label="Ignorar selecionados"
          variant="secondary"
          disabled={selectedIds.length === 0 || working}
          onPress={() => void bulkIgnore()}
        />
        <Button
          label="Ir para resumo"
          variant="secondary"
          onPress={() => router.push(`/(app)/capturas/${captureId}/resumo`)}
        />
      </View>

      <SubcategoryPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        categories={categories}
        defaultCategoryId={capture?.defaultCategoryId}
        recentSubcategoryIds={recentSubcategoryIds}
        onSelect={(subcategoryId) => void bulkAssign(subcategoryId)}
      />

      <Modal visible={addVisible} animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <Screen scroll>
          <Text variant="title">Adicionar item</Text>
          <Input label="Descrição" value={newDescription} onChangeText={setNewDescription} />
          <Input label="Quantidade (opcional)" value={newQuantity} onChangeText={setNewQuantity} />
          <Input label="Unidade (opcional)" value={newUnit} onChangeText={setNewUnit} />
          <MoneyInput
            label="Preço unitário (opcional)"
            cents={newUnitPrice}
            onChangeCents={setNewUnitPrice}
          />
          <MoneyInput label="Valor" cents={newLineTotal} onChangeCents={setNewLineTotal} />
          <Button label="Salvar item" disabled={working} onPress={() => void handleAddItem()} />
          <Button label="Cancelar" variant="secondary" onPress={() => setAddVisible(false)} />
        </Screen>
      </Modal>
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
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 16,
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  itemMeta: {
    flex: 1,
    gap: 4,
  },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
