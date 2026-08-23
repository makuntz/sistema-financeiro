'use client';

import {
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { useUnsavedChanges } from '@/components/unsaved-changes';
import { PlanningCategorySection } from '@/features/planning/planning-category-section';
import { PlanningSidePanel } from '@/features/planning/planning-side-panel';
import { PlanningSummaryCards } from '@/features/planning/planning-summary-cards';
import { formatMonthPeriod } from '@/features/planning/planning-metrics';
import { getPermissions, normalizeRole } from '@/lib/permissions';
import {
  addCentsStrings,
  buildPlanningHref,
  formatMonthTitle,
  parsePlanningSearchParams,
  shiftMonth,
  subtractCentsStrings,
  type PlanningTab,
} from '@/lib/planning-period';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, MoneyDisplay } from '@pp-planning/ui-web';

type SubcategoryPlan = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  plannedAmountInCents: string;
};

type CategoryPlan = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
  plannedAmountInCents: string;
  subcategories: SubcategoryPlan[];
};

type MonthlyPlan = {
  id: string | null;
  exists: boolean;
  workspaceId: string;
  year: number;
  month: number;
  version: number | null;
  currency: string;
  totals: {
    incomePlannedInCents: string;
    expensePlannedInCents: string;
    projectedBalanceInCents: string;
  };
  categories: CategoryPlan[];
};

type DraftAmounts = Record<string, string>;

type ComparisonSub = {
  subcategoryId: string;
  plannedInCents: string;
  realizedInCents: string;
  differenceInCents: string;
};

type ComparisonCategory = {
  categoryId: string;
  kind: 'income' | 'expense';
  plannedInCents: string;
  realizedInCents: string;
  differenceInCents: string;
  subcategories: ComparisonSub[];
};

type BudgetComparison = {
  totalPlannedIncomeInCents: string;
  totalRealizedIncomeInCents: string;
  totalPlannedExpenseInCents: string;
  totalRealizedExpenseInCents: string;
  projectedBalanceInCents?: string;
  realizedBalanceInCents?: string;
  incomeBalanceInCents: string;
  expenseBalanceInCents: string;
  categories: ComparisonCategory[];
};

const TABS: { id: PlanningTab; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'receitas', label: 'Receitas' },
  { id: 'gastos', label: 'Gastos' },
];

function buildDraftFromPlan(plan: MonthlyPlan | null): DraftAmounts {
  if (!plan) return {};
  const draft: DraftAmounts = {};
  for (const category of plan.categories) {
    for (const sub of category.subcategories) {
      draft[sub.id] = sub.plannedAmountInCents ?? '0';
    }
  }
  return draft;
}

function computeLocalTotals(categories: CategoryPlan[], draft: DraftAmounts) {
  const incomeValues: string[] = [];
  const expenseValues: string[] = [];

  for (const category of categories) {
    for (const sub of category.subcategories) {
      const value = draft[sub.id] ?? sub.plannedAmountInCents ?? '0';
      if (category.type === 'income') incomeValues.push(value);
      else expenseValues.push(value);
    }
  }

  const incomePlannedInCents = addCentsStrings(incomeValues);
  const expensePlannedInCents = addCentsStrings(expenseValues);
  const projectedBalanceInCents = subtractCentsStrings(incomePlannedInCents, expensePlannedInCents);

  return { incomePlannedInCents, expensePlannedInCents, projectedBalanceInCents };
}

function categorySubtotal(category: CategoryPlan, draft: DraftAmounts): string {
  return addCentsStrings(
    category.subcategories.map((sub) => draft[sub.id] ?? sub.plannedAmountInCents ?? '0'),
  );
}

function countSources(categories: CategoryPlan[]) {
  return {
    categoryCount: categories.length,
    subcategoryCount: categories.reduce((acc, cat) => acc + cat.subcategories.length, 0),
  };
}

export default function PlanejamentoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDirty, confirmIfDirty } = useUnsavedChanges();

  const { year, month, tab, normalized } = useMemo(
    () => parsePlanningSearchParams(searchParams),
    [searchParams],
  );

  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [comparison, setComparison] = useState<BudgetComparison | null>(null);
  const [draft, setDraft] = useState<DraftAmounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [role, setRole] = useState('viewer');
  const [showValues, setShowValues] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const permissions = getPermissions(role);
  const canWrite = permissions.canWritePlanning;

  const comparisonBySub = useMemo(() => {
    const map = new Map<string, ComparisonSub & { kind: 'income' | 'expense' }>();
    if (!comparison) return map;
    for (const cat of comparison.categories) {
      for (const sub of cat.subcategories) {
        map.set(sub.subcategoryId, { ...sub, kind: cat.kind });
      }
    }
    return map;
  }, [comparison]);

  const comparisonByCategory = useMemo(() => {
    const map = new Map<string, ComparisonCategory>();
    if (!comparison) return map;
    for (const cat of comparison.categories) {
      map.set(cat.categoryId, cat);
    }
    return map;
  }, [comparison]);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    setVersionConflict(false);
    try {
      const [planRes, comparisonRes] = await Promise.all([
        fetch(`/api/bff/planning/monthly/${year}/${month}`),
        fetch(`/api/bff/reports/monthly-budget/${year}/${month}`),
      ]);
      if (!planRes.ok) {
        const body = await planRes.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? body?.error ?? 'Erro ao carregar planejamento');
      }
      const data = (await planRes.json()) as MonthlyPlan;
      setPlan(data);
      setDraft(buildDraftFromPlan(data));
      setEditMode(false);
      setDirty(false);

      if (comparisonRes.ok) {
        setComparison((await comparisonRes.json()) as BudgetComparison);
      } else {
        setComparison(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar planejamento');
      setPlan(null);
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, setDirty]);

  useEffect(() => {
    if (normalized) {
      router.replace(buildPlanningHref(year, month, tab));
    }
  }, [normalized, year, month, tab, router]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    fetch('/api/bff/workspaces')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        const first = list[0];
        const workspaceRole =
          first?.role ?? first?.workspace?.role ?? first?.member?.role ?? 'viewer';
        setRole(normalizeRole(workspaceRole));
      })
      .catch(() => undefined);
  }, []);

  const isDraftDirty = useMemo(() => {
    if (!plan) return false;
    return plan.categories.some((category) =>
      category.subcategories.some(
        (sub) => (draft[sub.id] ?? '0') !== (sub.plannedAmountInCents ?? '0'),
      ),
    );
  }, [plan, draft]);

  useEffect(() => {
    setDirty(editMode && isDraftDirty);
  }, [editMode, isDraftDirty, setDirty]);

  useEffect(() => {
    if (!isDraftDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDraftDirty]);

  const displayTotals = useMemo(() => {
    if (!plan) {
      return {
        incomePlannedInCents: '0',
        expensePlannedInCents: '0',
        projectedBalanceInCents: '0',
      };
    }
    if (editMode) return computeLocalTotals(plan.categories, draft);
    return plan.totals;
  }, [plan, editMode, draft]);

  const filteredCategories = useMemo(() => {
    if (!plan) return [];
    if (tab === 'receitas') return plan.categories.filter((c) => c.type === 'income');
    if (tab === 'gastos') return plan.categories.filter((c) => c.type === 'expense');
    return plan.categories;
  }, [plan, tab]);

  useEffect(() => {
    if (!plan || tab === 'resumo') return;
    if (filteredCategories.length === 0) return;
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      return new Set(filteredCategories.map((category) => category.id));
    });
  }, [plan, tab, filteredCategories]);

  function navigateMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    confirmIfDirty(() => {
      router.push(buildPlanningHref(next.year, next.month, tab));
    });
  }

  function navigateTab(nextTab: PlanningTab) {
    if (nextTab === tab) return;
    confirmIfDirty(() => {
      router.push(buildPlanningHref(year, month, nextTab));
    });
  }

  function toggleExpand(categoryId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function startEdit() {
    if (!plan || !canWrite) return;
    setDraft(buildDraftFromPlan(plan));
    setEditMode(true);
    setSuccessMessage('');
    setError('');
  }

  function cancelEdit() {
    if (!plan) return;
    setDraft(buildDraftFromPlan(plan));
    setEditMode(false);
    setDirty(false);
    setError('');
  }

  async function handleSave() {
    if (!plan || !canWrite) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    setVersionConflict(false);

    const items = plan.categories.flatMap((category) =>
      category.subcategories.map((sub) => ({
        subcategoryId: sub.id,
        plannedAmountInCents: draft[sub.id] ?? '0',
      })),
    );

    try {
      const res = await fetch(`/api/bff/planning/monthly/${year}/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: plan.version,
          items,
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body?.error?.code === 'PLAN_VERSION_CONFLICT') {
          setVersionConflict(true);
          setError(
            'Outra pessoa alterou este planejamento. Recarregue para ver a versão mais recente.',
          );
          return;
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? body?.error ?? 'Erro ao salvar planejamento');
      }

      const saved = (await res.json()) as MonthlyPlan;
      setPlan(saved);
      setDraft(buildDraftFromPlan(saved));
      setEditMode(false);
      setDirty(false);
      setSuccessMessage('Planejamento salvo com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar planejamento');
    } finally {
      setSaving(false);
    }
  }

  async function executeCopyPrevious(overwrite: boolean) {
    if (!plan || !canWrite) return;
    setCopying(true);
    setError('');
    setSuccessMessage('');
    setVersionConflict(false);

    try {
      const res = await fetch(`/api/bff/planning/monthly/${year}/${month}/copy-previous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overwrite,
          expectedVersion: plan.version,
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body?.error?.code === 'PLAN_VERSION_CONFLICT') {
          setVersionConflict(true);
          setError(
            'Outra pessoa alterou este planejamento. Recarregue para ver a versão mais recente.',
          );
          return;
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = body?.error?.code;
        if (code === 'PREVIOUS_PLAN_NOT_FOUND') {
          setError('Não há planejamento no mês anterior para copiar.');
          return;
        }
        throw new Error(body?.error?.message ?? body?.error ?? 'Erro ao copiar planejamento');
      }

      const copied = (await res.json()) as MonthlyPlan;
      setPlan(copied);
      setDraft(buildDraftFromPlan(copied));
      setEditMode(false);
      setDirty(false);
      setSuccessMessage('Valores copiados do mês anterior.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao copiar planejamento');
    } finally {
      setCopying(false);
      setCopyConfirmOpen(false);
    }
  }

  function handleCopyPrevious() {
    if (!plan || !canWrite) return;
    confirmIfDirty(() => {
      if (plan.exists) {
        setCopyConfirmOpen(true);
        return;
      }
      void executeCopyPrevious(false);
    });
  }

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h1>Planejamento mensal</h1>
          <p>Carregando {formatMonthTitle(year, month)}…</p>
        </div>
      </div>
    );
  }

  const hasCategories = (plan?.categories.length ?? 0) > 0;
  const incomeRealized = comparison?.totalRealizedIncomeInCents ?? '0';
  const expenseRealized = comparison?.totalRealizedExpenseInCents ?? '0';
  const tabSourceStats = countSources(filteredCategories);
  const period = formatMonthPeriod(year, month);

  return (
    <div className="planning-page">
      <header className="planning-topbar">
        <div className="planning-topbar-title">
          <h1>{editMode ? 'Editar Planejamento' : 'Planejamento Mensal'}</h1>
          <p className="planning-topbar-period">
            {period.startLabel} até {period.endLabel}
            <span aria-hidden="true"> · </span>
            {period.days} {period.days === 1 ? 'dia' : 'dias'}
            {!canWrite ? <span> · Somente leitura</span> : null}
          </p>
        </div>

        <div className="planning-month-nav" aria-label="Navegação do mês">
          <Button variant="secondary" aria-label="Mês anterior" onClick={() => navigateMonth(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="planning-month-label">
            <CalendarRange size={16} aria-hidden="true" />
            {formatMonthTitle(year, month)}
          </span>
          <Button variant="secondary" aria-label="Próximo mês" onClick={() => navigateMonth(1)}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="planning-topbar-actions">
          {canWrite && editMode ? (
            <>
              <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="ghost" onClick={handleCopyPrevious} disabled={copying || saving}>
                <Copy size={14} /> Copiar mês anterior
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving || !hasCategories}>
                <Check size={14} /> {saving ? 'Salvando…' : 'Salvar planejamento'}
              </Button>
            </>
          ) : null}
          {canWrite && !editMode ? (
            <>
              <Button variant="ghost" onClick={handleCopyPrevious} disabled={copying}>
                <Copy size={14} /> Copiar mês anterior
              </Button>
              <Button variant="ghost" onClick={startEdit} disabled={!hasCategories}>
                <Pencil size={14} /> Editar planejamento
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {successMessage ? (
        <Alert variant="success" style={{ marginBottom: '1rem' }}>
          {successMessage}
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="danger" style={{ marginBottom: '1rem' }}>
          {error}
          {versionConflict ? (
            <div style={{ marginTop: '0.75rem' }}>
              <Button variant="secondary" onClick={() => void loadPlan()}>
                <RotateCcw size={16} /> Recarregar
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      {hasCategories && tab === 'resumo' ? (
        <PlanningSummaryCards
          tab={tab}
          year={year}
          month={month}
          editMode={editMode}
          incomePlannedInCents={displayTotals.incomePlannedInCents}
          expensePlannedInCents={displayTotals.expensePlannedInCents}
          projectedBalanceInCents={displayTotals.projectedBalanceInCents}
          incomeRealizedInCents={incomeRealized}
          expenseRealizedInCents={expenseRealized}
        />
      ) : null}

      <div className="planning-tabs-row">
        <div className="planning-tabs" role="tablist" aria-label="Seções do planejamento">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`planning-tab${tab === item.id ? ' is-active' : ''}`}
              aria-selected={tab === item.id}
              onClick={() => navigateTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab !== 'resumo' ? (
          <div className="planning-view-controls" aria-label="Controles de visualização">
            <button
              type="button"
              className={`planning-view-btn${showValues ? ' is-active' : ''}`}
              onClick={() => setShowValues((value) => !value)}
              aria-pressed={showValues}
            >
              {showValues ? <Eye size={16} /> : <EyeOff size={16} />}
              Ver valores
            </button>
            <div className="planning-view-toggle" role="group" aria-label="Modo de lista">
              <button
                type="button"
                className={`planning-view-icon${viewMode === 'list' ? ' is-active' : ''}`}
                aria-label="Visualização em lista"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className={`planning-view-icon${viewMode === 'grid' ? ' is-active' : ''}`}
                aria-label="Visualização em grade"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!hasCategories ? (
        <EmptyState
          icon={<CalendarRange size={40} />}
          title="Nenhuma categoria configurada"
          description="Configure categorias e subcategorias antes de montar o planejamento mensal."
          action={
            <Link href="/configuracoes/categorias">
              <Button>Ir para categorias</Button>
            </Link>
          }
        />
      ) : tab === 'resumo' ? (
        !plan?.exists && !editMode ? (
          <EmptyState
            icon={<CalendarRange size={40} />}
            title="Nenhum planejamento neste mês"
            description={
              canWrite
                ? 'Comece do zero ou copie os valores do mês anterior.'
                : 'Este mês ainda não possui planejamento salvo.'
            }
            action={
              canWrite ? (
                <div className="planning-empty-actions">
                  <Button onClick={startEdit}>Começar planejamento</Button>
                  <Button variant="secondary" onClick={handleCopyPrevious} disabled={copying}>
                    Copiar mês anterior
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <section className="panel">
            <h2>Resumo por categoria</h2>
            {plan?.categories.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma categoria disponível.</p>
            ) : (
              <ul className="planning-resumo-list">
                {plan?.categories.map((category) => (
                  <li
                    key={category.id}
                    className="planning-resumo-item"
                    style={{ opacity: category.isActive ? 1 : 0.65 }}
                  >
                    <div className="planning-resumo-identity">
                      <span
                        className="planning-category-dot"
                        style={{ background: category.color }}
                        aria-hidden="true"
                      />
                      <span className="planning-category-name">{category.name}</span>
                      {!category.isActive ? <Badge variant="warning">Arquivada</Badge> : null}
                    </div>
                    <MoneyDisplay
                      cents={BigInt(
                        editMode
                          ? categorySubtotal(category, draft)
                          : category.plannedAmountInCents || '0',
                      )}
                      tone={category.type === 'income' ? 'income' : 'expense'}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          title={tab === 'receitas' ? 'Nenhuma receita configurada' : 'Nenhuma despesa configurada'}
          description="Adicione categorias do tipo correto em Configurações."
          action={
            <Link href="/configuracoes/categorias">
              <Button variant="secondary">Configurar categorias</Button>
            </Link>
          }
        />
      ) : (
        <div className={`planning-workspace${editMode ? ' is-editing' : ''}`}>
          <div className="planning-main-column">
            <div className={`planning-categories${viewMode === 'grid' ? ' is-grid' : ''}`}>
              {filteredCategories.map((category) => {
                const comparisonCat = comparisonByCategory.get(category.id);
                const plannedInCents = editMode
                  ? categorySubtotal(category, draft)
                  : (comparisonCat?.plannedInCents ?? category.plannedAmountInCents ?? '0');
                const realizedInCents = comparisonCat?.realizedInCents ?? '0';

                return (
                  <PlanningCategorySection
                    key={category.id}
                    isOpen={expanded.has(category.id)}
                    onToggle={() => toggleExpand(category.id)}
                    editMode={editMode}
                    canWrite={canWrite}
                    hideValues={!showValues}
                    onPlannedChange={(subcategoryId, value) =>
                      setDraft((prev) => ({ ...prev, [subcategoryId]: value }))
                    }
                    category={{
                      id: category.id,
                      name: category.name,
                      type: category.type,
                      color: category.color,
                      icon: category.icon,
                      isActive: category.isActive,
                      plannedInCents,
                      realizedInCents,
                      subcategories: category.subcategories.map((sub) => {
                        const comparisonSub = comparisonBySub.get(sub.id);
                        return {
                          id: sub.id,
                          name: sub.name,
                          isActive: sub.isActive,
                          plannedInCents: editMode
                            ? (draft[sub.id] ?? sub.plannedAmountInCents ?? '0')
                            : (comparisonSub?.plannedInCents ?? sub.plannedAmountInCents ?? '0'),
                          realizedInCents: comparisonSub?.realizedInCents ?? '0',
                        };
                      }),
                    }}
                  />
                );
              })}
            </div>

            <Link href="/configuracoes/categorias" className="planning-add-row">
              + {tab === 'receitas' ? 'Adicionar fonte de receita' : 'Adicionar categoria de gasto'}
            </Link>
          </div>

          {editMode ? (
            <PlanningSidePanel
              tab={tab}
              canWrite={canWrite}
              copying={copying}
              incomePlannedInCents={displayTotals.incomePlannedInCents}
              expensePlannedInCents={displayTotals.expensePlannedInCents}
              categoryCount={tabSourceStats.categoryCount}
              subcategoryCount={tabSourceStats.subcategoryCount}
              positiveBalanceCount={
                filteredCategories.filter((category) => {
                  const comparisonCat = comparisonByCategory.get(category.id);
                  const planned = editMode
                    ? categorySubtotal(category, draft)
                    : (comparisonCat?.plannedInCents ?? category.plannedAmountInCents ?? '0');
                  const realized = comparisonCat?.realizedInCents ?? '0';
                  return BigInt(planned) - BigInt(realized) >= 0n;
                }).length
              }
              onCopyPrevious={handleCopyPrevious}
            />
          ) : null}
        </div>
      )}

      {editMode && isDraftDirty ? (
        <div className="planning-sticky-bar" role="status">
          <span>Você tem alterações não salvas</span>
          <div className="planning-sticky-actions">
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar planejamento'}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={copyConfirmOpen}
        onClose={() => setCopyConfirmOpen(false)}
        onConfirm={() => void executeCopyPrevious(true)}
        title="Substituir planejamento atual?"
        description="Este mês já possui um planejamento. Copiar do mês anterior substituirá os valores atuais."
        confirmLabel="Substituir"
        cancelLabel="Manter atual"
        tone="danger"
        busy={copying}
      />
    </div>
  );
}
