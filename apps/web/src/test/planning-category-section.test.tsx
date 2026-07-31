import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanningCategorySection } from '../features/planning/planning-category-section';
import { PlanningColumnHeader } from '../features/planning/planning-column-header';
import { getPlanningColumnLabels } from '../features/planning/planning-metrics';

describe('PlanningCategorySection', () => {
  const expenseCategory = {
    id: 'cat-1',
    name: 'Mantimentos',
    type: 'expense' as const,
    color: '#2563eb',
    icon: 'shopping-basket',
    isActive: true,
    plannedInCents: '210000',
    realizedInCents: '26000',
    subcategories: [
      {
        id: 'sub-1',
        name: 'Mercado semanal',
        isActive: true,
        plannedInCents: '90000',
        realizedInCents: '26000',
      },
      {
        id: 'sub-2',
        name: 'Mercado final de semana',
        isActive: true,
        plannedInCents: '120000',
        realizedInCents: '0',
      },
    ],
  };

  it('renders category totals, usage and subcategories when open', () => {
    render(
      <>
        <PlanningColumnHeader labels={getPlanningColumnLabels('expense')} showUsage />
        <PlanningCategorySection
          category={expenseCategory}
          isOpen
          onToggle={vi.fn()}
          editMode={false}
          canWrite
          onPlannedChange={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('button', { name: /Mantimentos/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('columnheader', { name: 'Categoria / Subcategoria' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Planejado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Realizado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Disponível' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Utilizado' })).toBeInTheDocument();
    expect(screen.getByText('Mercado semanal')).toBeInTheDocument();
    expect(screen.getByText('2 subcategorias')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 900,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 260,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 640,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12,4%/).length).toBeGreaterThan(0);
  });

  it('shows Acima do planejado when remaining is negative', () => {
    render(
      <PlanningCategorySection
        category={{
          ...expenseCategory,
          plannedInCents: '10000',
          realizedInCents: '25000',
          subcategories: [
            {
              id: 'sub-over',
              name: 'Estouro',
              isActive: true,
              plannedInCents: '10000',
              realizedInCents: '25000',
            },
          ],
        }}
        isOpen
        onToggle={vi.fn()}
        editMode={false}
        canWrite
        onPlannedChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Acima do planejado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('- R$ 150,00').length).toBeGreaterThan(0);
  });

  it('keeps MoneyInput in planned column while editing income', () => {
    const onPlannedChange = vi.fn();
    render(
      <>
        <PlanningColumnHeader labels={getPlanningColumnLabels('income')} />
        <PlanningCategorySection
          category={{
            id: 'cat-income',
            name: 'Salário',
            type: 'income',
            color: '#059669',
            isActive: true,
            plannedInCents: '500000',
            realizedInCents: '0',
            subcategories: [
              {
                id: 'sub-income',
                name: 'Principal',
                isActive: true,
                plannedInCents: '500000',
                realizedInCents: '0',
              },
            ],
          }}
          isOpen
          onToggle={vi.fn()}
          editMode
          canWrite
          onPlannedChange={onPlannedChange}
        />
      </>,
    );

    expect(screen.getByRole('columnheader', { name: 'Fonte de receita' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Planejado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Realizado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Diferença' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Disponível' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Utilizado' })).not.toBeInTheDocument();
  });

  it('toggles accordion via header button', () => {
    const onToggle = vi.fn();
    render(
      <PlanningCategorySection
        category={expenseCategory}
        isOpen={false}
        onToggle={onToggle}
        editMode={false}
        canWrite={false}
        onPlannedChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Mercado semanal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mantimentos/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not expose MoneyInput for viewer (read-only)', () => {
    render(
      <PlanningCategorySection
        category={expenseCategory}
        isOpen
        onToggle={vi.fn()}
        editMode
        canWrite={false}
        onPlannedChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
