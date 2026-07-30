'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  MoneyDisplay,
  MoneyInput,
} from '@pp-planning/ui-web';
import { formatCentsToBRL } from '@pp-planning/contracts';
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { useUnsavedChanges } from '@/components/unsaved-changes';
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

export default function PlanejamentoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDirty, confirmIfDirty } = useUnsavedChanges();

  const { year, month, tab, normalized } = useMemo(
    () => parsePlanningSearchParams(searchParams),
    [searchParams],
  );

  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
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

  const permissions = getPermissions(role);
  const canWrite = permissions.canWritePlanning;

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    setVersionConflict(false);
    try {
      const res = await fetch(`/api/bff/planning/monthly/${year}/${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? body?.error ?? 'Erro ao carregar planejamento');
      }
      const data = (await res.json()) as MonthlyPlan;
      setPlan(data);
      setDraft(buildDraftFromPlan(data));
      setEditMode(false);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar planejamento');
      setPlan(null);
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
  const balanceTone =
    BigInt(displayTotals.projectedBalanceInCents || '0') >= 0n ? 'income' : 'expense';

  return (
    <div style={{ paddingBottom: editMode && isDraftDirty ? '5rem' : undefined }}>
      <div className="page-header">
        <div>
          <h1>Planejamento mensal</h1>
          <p>
            Defina quanto pretende receber e gastar em{' '}
            <strong>{formatMonthTitle(year, month)}</strong>.
            {!canWrite ? ' Você tem acesso somente leitura.' : null}
          </p>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Button variant="secondary" aria-label="Mês anterior" onClick={() => navigateMonth(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <span style={{ fontWeight: 600, minWidth: '10rem', textAlign: 'center' }}>
              {formatMonthTitle(year, month)}
            </span>
            <Button variant="secondary" aria-label="Próximo mês" onClick={() => navigateMonth(1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
          {canWrite && !editMode ? (
            <>
              <Button variant="secondary" onClick={handleCopyPrevious} disabled={copying}>
                <Copy size={16} /> Copiar mês anterior
              </Button>
              <Button onClick={startEdit} disabled={!hasCategories}>
                <Pencil size={16} /> Editar
              </Button>
            </>
          ) : null}
        </div>
      </div>

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

      <div
        role="tablist"
        aria-label="Seções do planejamento"
        style={{
          display: 'flex',
          gap: '0.35rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: '0.35rem',
        }}
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => navigateTab(item.id)}
            style={{
              border: 0,
              background: tab === item.id ? 'var(--action-primary-soft)' : 'transparent',
              color: tab === item.id ? 'var(--action-primary)' : 'var(--text-secondary)',
              fontWeight: tab === item.id ? 600 : 500,
              padding: '0.55rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
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
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-card-label">Receitas previstas</div>
              <div className="stat-card-value">
                <MoneyDisplay
                  cents={BigInt(displayTotals.incomePlannedInCents || '0')}
                  tone="income"
                />
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Gastos previstos</div>
              <div className="stat-card-value">
                <MoneyDisplay
                  cents={BigInt(displayTotals.expensePlannedInCents || '0')}
                  tone="expense"
                />
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Saldo projetado</div>
              <div className="stat-card-value">
                <MoneyDisplay
                  cents={BigInt(displayTotals.projectedBalanceInCents || '0')}
                  tone={balanceTone}
                />
              </div>
              <div className="stat-card-hint">
                {formatCentsToBRL(displayTotals.projectedBalanceInCents)}
              </div>
            </div>
          </div>

          {!plan?.exists && !editMode ? (
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
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
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
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'grid',
                    gap: '0.65rem',
                  }}
                >
                  {plan?.categories.map((category) => (
                    <li
                      key={category.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        opacity: category.isActive ? 1 : 0.65,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            width: '0.65rem',
                            height: '0.65rem',
                            borderRadius: '50%',
                            background: category.color,
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{category.name}</span>
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
          )}
        </>
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
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {filteredCategories.map((category) => {
            const isOpen = expanded.has(category.id);
            return (
              <section
                key={category.id}
                className="panel"
                style={{ opacity: category.isActive ? 1 : 0.65 }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(category.id)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                    color: 'inherit',
                  }}
                >
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span
                    style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '50%',
                      background: category.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontWeight: 600 }}>{category.name}</span>
                  {!category.isActive ? <Badge variant="warning">Arquivada</Badge> : null}
                  <MoneyDisplay
                    cents={BigInt(
                      editMode
                        ? categorySubtotal(category, draft)
                        : category.plannedAmountInCents || '0',
                    )}
                    tone={category.type === 'income' ? 'income' : 'expense'}
                  />
                </button>

                {isOpen ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '0.85rem 0 0 2rem',
                      padding: 0,
                      display: 'grid',
                      gap: '0.75rem',
                    }}
                  >
                    {category.subcategories.length === 0 ? (
                      <li style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Nenhuma subcategoria
                      </li>
                    ) : (
                      category.subcategories.map((sub) => (
                        <li
                          key={sub.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            opacity: sub.isActive ? 1 : 0.65,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{sub.name}</span>
                            {!sub.isActive ? <Badge variant="warning">Inativa</Badge> : null}
                          </div>
                          {editMode && canWrite ? (
                            <div style={{ minWidth: '11rem' }}>
                              <MoneyInput
                                label={sub.name}
                                valueInCents={draft[sub.id] ?? '0'}
                                onChange={(value: string) =>
                                  setDraft((prev) => ({ ...prev, [sub.id]: value }))
                                }
                              />
                            </div>
                          ) : (
                            <MoneyDisplay
                              cents={BigInt(sub.plannedAmountInCents || '0')}
                              tone={category.type === 'income' ? 'income' : 'expense'}
                            />
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {editMode && isDraftDirty ? (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 'var(--sidebar-width)',
            right: 0,
            zIndex: 30,
            background: 'var(--surface-elevated)',
            borderTop: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-md)',
            padding: '0.85rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Você tem alterações não salvas
          </span>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
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
