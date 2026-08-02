import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { CategoryWithSubcategoriesDto } from '@pp-planning/contracts';
import { Button, Text, useSemanticTokens } from '@pp-planning/ui-mobile';

export type SubcategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
};

type SubcategoryPickerProps = {
  visible: boolean;
  onClose: () => void;
  categories: CategoryWithSubcategoriesDto[];
  defaultCategoryId?: string | null;
  recentSubcategoryIds?: string[];
  onSelect: (subcategoryId: string) => void;
};

export function SubcategoryPicker({
  visible,
  onClose,
  categories,
  defaultCategoryId,
  recentSubcategoryIds = [],
  onSelect,
}: SubcategoryPickerProps) {
  const tokens = useSemanticTokens();
  const [search, setSearch] = useState('');

  const options = useMemo(() => {
    const all: SubcategoryOption[] = categories.flatMap((category) =>
      (category.subcategories ?? [])
        .filter((sub) => sub.isActive)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          categoryId: category.id,
          categoryName: category.name,
        })),
    );

    const normalizedSearch = search.trim().toLowerCase();
    const filtered = normalizedSearch
      ? all.filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedSearch) ||
            item.categoryName.toLowerCase().includes(normalizedSearch),
        )
      : all;

    const recent = recentSubcategoryIds
      .map((id) => filtered.find((item) => item.id === id))
      .filter((item): item is SubcategoryOption => Boolean(item));

    const defaultCategory = defaultCategoryId
      ? filtered.filter((item) => item.categoryId === defaultCategoryId)
      : [];

    const recentIds = new Set(recent.map((item) => item.id));
    const defaultIds = new Set(defaultCategory.map((item) => item.id));
    const others = filtered.filter((item) => !recentIds.has(item.id) && !defaultIds.has(item.id));

    return { recent, defaultCategory, others };
  }, [categories, defaultCategoryId, recentSubcategoryIds, search]);

  const renderSection = (title: string, items: SubcategoryOption[]) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text variant="eyebrow">{title}</Text>
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => {
              onSelect(item.id);
              onClose();
              setSearch('');
            }}
            style={[styles.option, { borderColor: tokens.border.default }]}
          >
            <Text>{item.name}</Text>
            <Text tone="secondary" variant="caption">
              {item.categoryName}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: tokens.background.default }]}>
        <Text variant="title">Escolher subcategoria</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar..."
          placeholderTextColor={tokens.text.secondary}
          style={[
            styles.search,
            {
              color: tokens.text.primary,
              borderColor: tokens.border.default,
              backgroundColor: tokens.surface.default,
            },
          ]}
        />
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {renderSection('Recentes', options.recent)}
              {renderSection('Categoria padrão', options.defaultCategory)}
              {renderSection('Outras', options.others)}
            </>
          }
        />
        <Button label="Fechar" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    paddingTop: 48,
  },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  section: {
    gap: 8,
    marginBottom: 16,
  },
  option: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
});
