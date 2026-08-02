import { useCallback, useEffect, useState } from 'react';
import type { CategoryWithSubcategoriesDto } from '@pp-planning/contracts';
import { apiClient } from '@/src/lib/api';

export function useCategories(type?: 'income' | 'expense') {
  const [categories, setCategories] = useState<CategoryWithSubcategoriesDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listCategories({
        type,
        includeInactive: false,
      });
      setCategories(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { categories, loading, error, reload };
}

export function flattenSubcategories(categories: CategoryWithSubcategoriesDto[]) {
  return categories.flatMap((category) =>
    (category.subcategories ?? [])
      .filter((sub) => sub.isActive)
      .map((sub) => ({
        ...sub,
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
      })),
  );
}
