import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedChangesProvider } from '../components/unsaved-changes';

const navigation = vi.hoisted(() => ({
  tab: 'resumo',
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navigation.pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams({ ano: '2026', mes: '7', aba: navigation.tab }),
}));

import PlanejamentoPage from '../app/(app)/planejamento/planejamento-client';

const basePlan = {
  id: 'plan-1',
  exists: true,
  workspaceId: 'ws-1',
  year: 2026,
  month: 7,
  version: 1,
  currency: 'BRL',
  totals: {
    incomePlannedInCents: '500000',
    expensePlannedInCents: '200000',
    projectedBalanceInCents: '300000',
  },
  categories: [
    {
      id: 'cat-income',
      name: 'Salário',
      type: 'income' as const,
      color: '#059669',
      icon: 'wallet',
      order: 1,
      isActive: true,
      plannedAmountInCents: '500000',
      subcategories: [
        {
          id: 'sub-income',
          name: 'Principal',
          order: 1,
          isActive: true,
          plannedAmountInCents: '500000',
        },
      ],
    },
    {
      id: 'cat-expense',
      name: 'Moradia',
      type: 'expense' as const,
      color: '#E11D48',
      icon: 'home',
      order: 2,
      isActive: false,
      plannedAmountInCents: '200000',
      subcategories: [
        {
          id: 'sub-expense',
          name: 'Aluguel',
          order: 1,
          isActive: true,
          plannedAmountInCents: '200000',
        },
      ],
    },
  ],
};

function mockFetch(role: string) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/api/bff/workspaces')) {
      return {
        ok: true,
        json: async () => [{ id: 'ws-1', name: 'Demo', role }],
      } as Response;
    }

    if (url.includes('/api/bff/planning/monthly/2026/7')) {
      return {
        ok: true,
        json: async () => basePlan,
      } as Response;
    }

    if (url.includes('/api/bff/reports/monthly-budget/2026/7')) {
      return {
        ok: true,
        json: async () => ({
          year: 2026,
          month: 7,
          currency: 'BRL',
          totalPlannedIncomeInCents: '500000',
          totalRealizedIncomeInCents: '0',
          totalPlannedExpenseInCents: '200000',
          totalRealizedExpenseInCents: '0',
          projectedBalanceInCents: '300000',
          realizedBalanceInCents: '0',
          incomeBalanceInCents: '-500000',
          expenseBalanceInCents: '200000',
          categories: [
            {
              categoryId: 'cat-income',
              categoryName: 'Salário',
              kind: 'income',
              plannedInCents: '500000',
              realizedInCents: '0',
              differenceInCents: '-500000',
              subcategories: [
                {
                  subcategoryId: 'sub-income',
                  subcategoryName: 'Principal',
                  plannedInCents: '500000',
                  realizedInCents: '0',
                  differenceInCents: '-500000',
                },
              ],
            },
            {
              categoryId: 'cat-expense',
              categoryName: 'Moradia',
              kind: 'expense',
              plannedInCents: '200000',
              realizedInCents: '0',
              differenceInCents: '200000',
              subcategories: [
                {
                  subcategoryId: 'sub-expense',
                  subcategoryName: 'Aluguel',
                  plannedInCents: '200000',
                  realizedInCents: '0',
                  differenceInCents: '200000',
                },
              ],
            },
          ],
        }),
      } as Response;
    }

    return { ok: false, json: async () => ({}) } as Response;
  });
}

function renderPlanning() {
  return render(
    <UnsavedChangesProvider>
      <PlanejamentoPage />
    </UnsavedChangesProvider>,
  );
}

describe('PlanejamentoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.tab = 'resumo';
  });

  it('renders open plan summary totals', async () => {
    mockFetch('member');
    renderPlanning();

    await waitFor(() => {
      expect(screen.getByText('Planejamento Mensal')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Receitas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gastos').length).toBeGreaterThan(0);
    expect(screen.getByText('Saldo previsto')).toBeInTheDocument();
    expect(screen.getByText('Período relativo')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 5.000,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 2.000,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 3.000,00').length).toBeGreaterThan(0);
    expect(screen.getByText('Arquivada')).toBeInTheDocument();
  });

  it('updates local totals while editing', async () => {
    navigation.tab = 'receitas';
    mockFetch('member');
    renderPlanning();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Editar planejamento/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Editar planejamento/i }));

    expect(screen.getByText('Editar Planejamento')).toBeInTheDocument();
    expect(screen.getByText('Resumo da edição')).toBeInTheDocument();

    const categoryToggle = screen.getByRole('button', { name: /Salário/i });
    fireEvent.click(categoryToggle);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '6000');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getAllByText('R$ 6.000,00').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Você tem alterações não salvas')).toBeInTheDocument();
  });

  it('hides edit and copy actions for viewer role', async () => {
    mockFetch('viewer');
    renderPlanning();

    await waitFor(() => {
      expect(screen.getByText(/acesso somente leitura/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Editar planejamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copiar mês anterior/i })).not.toBeInTheDocument();
  });

  it('shows Disponível and Utilizado headers on gastos', async () => {
    navigation.tab = 'gastos';
    mockFetch('member');
    renderPlanning();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Moradia/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: 'Categoria / Subcategoria' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Planejado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Realizado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Disponível' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Utilizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver valores/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Moradia/i }));
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
  });

  it('shows income column headers on receitas tab', async () => {
    navigation.tab = 'receitas';
    mockFetch('member');
    renderPlanning();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Salário/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: 'Fonte de receita' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Planejado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Realizado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Diferença' })).toBeInTheDocument();
  });
});
