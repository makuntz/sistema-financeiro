'use client';

import { formatCentsToBRL } from '@pp-planning/contracts';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { CategoryIconBadge } from '@/lib/category-icons';
import { getPermissions, normalizeRole } from '@/lib/permissions';
import {
  buildPlanningHref,
  formatMonthTitle,
  getSaoPauloYearMonth,
  parsePlanningSearchParams,
  shiftMonth,
} from '@/lib/planning-period';
import { useUnsavedChanges } from '@/components/unsaved-changes';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  MoneyDisplay,
  MoneyInput,
} from '@pp-planning/ui-web';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  isActive: boolean;
  subcategories?: Array<{ id: string; name: string; isActive: boolean }>;
};

type Member = {
  id: string;
  role?: string;
  user?: { id: string; name: string };
  name?: string;
};

type LedgerItem = {
  id: string;
  description: string;
  kind: 'income' | 'expense';
  amountInCents: string;
  occurredOn: string;
  competenceYear: number;
  competenceMonth: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  attributedMemberId: string | null;
  attributedMemberName: string | null;
  version: number;
  voidedAt: string | null;
};

type Summary = {
  totalIncomeInCents: string;
  totalExpenseInCents: string;
  balanceInCents: string;
  entryCount: number;
};

type FormState = {
  kind: 'income' | 'expense';
  description: string;
  amountInCents: string;
  occurredOn: string;
  competenceYear: number;
  competenceMonth: number;
  categoryId: string;
  subcategoryId: string;
  attributedMemberId: string;
  competenceManual: boolean;
};

function todayDateOnly(): string {
  const { year, month } = getSaoPauloYearMonth();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
  }).formatToParts(new Date());
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${String(month).padStart(2, '0')}-${day}`;
}

function formatDisplayDate(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-');
  return `${d}/${m}/${y}`;
}

export function LancamentosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDirty, confirmIfDirty } = useUnsavedChanges();

  const parsed = useMemo(
    () => parsePlanningSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const year = parsed.year;
  const month = parsed.month;

  const [role, setRole] = useState('member');
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerItem | null>(null);
  const [voidTarget, setVoidTarget] = useState<LedgerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => {
    const today = todayDateOnly();
    const current = getSaoPauloYearMonth();
    return {
      kind: 'expense',
      description: '',
      amountInCents: '0',
      occurredOn: today,
      competenceYear: current.year,
      competenceMonth: current.month,
      categoryId: '',
      subcategoryId: '',
      attributedMemberId: '',
      competenceManual: false,
    };
  });

  const canWrite = getPermissions(role).canWriteLedger;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        competenceYear: String(year),
        competenceMonth: String(month),
        page: '1',
        pageSize: '50',
        includeVoided: String(includeVoided),
      });
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      if (search.trim()) params.set('search', search.trim());

      const [entriesRes, summaryRes, catsRes, membersRes, wsRes] = await Promise.all([
        fetch(`/api/bff/ledger/entries?${params}`),
        fetch(`/api/bff/ledger/monthly/${year}/${month}/summary`),
        fetch('/api/bff/categories'),
        fetch('/api/bff/members'),
        fetch('/api/bff/workspaces/current'),
      ]);

      if (wsRes.ok) {
        const ws = await wsRes.json();
        const r = ws?.role ?? ws?.membership?.role ?? ws?.workspace?.role;
        if (r) setRole(normalizeRole(r));
      }

      if (entriesRes.ok) {
        const body = await entriesRes.json();
        setItems(Array.isArray(body?.data) ? body.data : []);
      } else {
        setError('Não foi possível carregar os lançamentos.');
      }

      if (summaryRes.ok) setSummary(await summaryRes.json());

      if (catsRes.ok) {
        const body = await catsRes.json();
        const list = Array.isArray(body) ? body : (body?.data ?? []);
        setCategories(list);
      }

      if (membersRes.ok) {
        const body = await membersRes.json();
        const list = Array.isArray(body) ? body : (body?.data ?? []);
        setMembers(list);
      }
    } catch {
      setError('Erro de rede ao carregar lançamentos.');
    } finally {
      setLoading(false);
    }
  }, [year, month, kindFilter, search, includeVoided]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (parsed.normalized) {
      router.replace(`/lancamentos?ano=${year}&mes=${month}`);
    }
  }, [parsed.normalized, year, month, router]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === form.kind && c.isActive),
    [categories, form.kind],
  );

  const filteredSubcategories = useMemo(() => {
    const cat = categories.find((c) => c.id === form.categoryId);
    return (cat?.subcategories ?? []).filter((s) => s.isActive);
  }, [categories, form.categoryId]);

  function navigateMonth(delta: number) {
    confirmIfDirty(() => {
      const next = shiftMonth(year, month, delta);
      setDirty(false);
      router.push(`/lancamentos?ano=${next.year}&mes=${next.month}`);
    });
  }

  function openEdit(item: LedgerItem) {
    setEditing(item);
    setForm({
      kind: item.kind,
      description: item.description,
      amountInCents: item.amountInCents,
      occurredOn: item.occurredOn,
      competenceYear: item.competenceYear,
      competenceMonth: item.competenceMonth,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      attributedMemberId: item.attributedMemberId ?? '',
      competenceManual: true,
    });
    setDirty(false);
    setDialogOpen(true);
  }

  function updateForm(patch: Partial<FormState>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.occurredOn && !prev.competenceManual && !patch.competenceManual) {
        const [y, m] = patch.occurredOn.split('-');
        next.competenceYear = Number(y);
        next.competenceMonth = Number(m);
      }
      if (patch.competenceYear !== undefined || patch.competenceMonth !== undefined) {
        next.competenceManual = true;
      }
      if (patch.kind && patch.kind !== prev.kind) {
        next.categoryId = '';
        next.subcategoryId = '';
      }
      if (patch.categoryId && patch.categoryId !== prev.categoryId) {
        next.subcategoryId = '';
      }
      return next;
    });
    setDirty(true);
  }

  async function saveEntry() {
    if (!form.description.trim() || !form.subcategoryId || form.amountInCents === '0') {
      setError('Preencha descrição, subcategoria e um valor maior que zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        description: form.description.trim(),
        amountInCents: form.amountInCents,
        occurredOn: form.occurredOn,
        competenceYear: form.competenceYear,
        competenceMonth: form.competenceMonth,
        subcategoryId: form.subcategoryId,
        attributedMemberId: form.attributedMemberId || undefined,
        ...(editing ? { expectedVersion: editing.version } : {}),
      };

      const res = await fetch(
        editing ? `/api/bff/ledger/entries/${editing.id}` : '/api/bff/ledger/entries',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? body?.error ?? 'Não foi possível salvar o lançamento.');
        return;
      }
      setDialogOpen(false);
      setDirty(false);
      setStatus(editing ? 'Lançamento atualizado.' : 'Lançamento criado.');
      await load();
    } catch {
      setError('Erro de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bff/ledger/entries/${voidTarget.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: voidTarget.version }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Não foi possível excluir.');
        return;
      }
      setVoidTarget(null);
      setStatus('Lançamento excluído dos totais.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function restoreEntry(item: LedgerItem) {
    setSaving(true);
    try {
      const res = await fetch(`/api/bff/ledger/entries/${item.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: item.version }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Não foi possível restaurar.');
        return;
      }
      setStatus('Lançamento restaurado.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  const title = formatMonthTitle(year, month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);

  return (
    <div className="lancamentos-page">
      <header className="planning-topbar">
        <div className="planning-topbar-title">
          <h1>Histórico de Lançamentos</h1>
          <p>Acompanhe as receitas e os gastos que realmente aconteceram.</p>
        </div>

        <div className="planning-month-nav" aria-label="Navegação do mês">
          <Button variant="secondary" aria-label="Mês anterior" onClick={() => navigateMonth(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="planning-month-label">
            <CalendarDays size={16} aria-hidden />
            {title}
          </span>
          <Button variant="secondary" aria-label="Próximo mês" onClick={() => navigateMonth(1)}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="planning-topbar-actions">
          {canWrite ? (
            <>
              <Link href={`/lancamentos/novo?ano=${year}&mes=${month}&tipo=income`}>
                <Button variant="secondary">Nova receita</Button>
              </Link>
              <Link href={`/lancamentos/novo?ano=${year}&mes=${month}`}>
                <Button>
                  <Plus size={16} /> Novo lançamento
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <div aria-live="polite" style={{ marginBottom: '0.75rem' }}>
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}
      </div>

      {summary ? (
        <div className="stat-grid planning-summary-cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <article className="stat-card is-income">
            <div className="stat-card-label">
              <span className="planning-card-icon is-income" aria-hidden>
                <Wallet size={16} />
              </span>
              Receitas realizadas
            </div>
            <div className="stat-card-value is-income">
              <MoneyDisplay cents={BigInt(summary.totalIncomeInCents)} tone="income" />
            </div>
            <div className="stat-card-hint is-income">{summary.entryCount} lançamentos no mês</div>
          </article>
          <article className="stat-card is-expense">
            <div className="stat-card-label">
              <span className="planning-card-icon is-expense" aria-hidden>
                <ShoppingCart size={16} />
              </span>
              Gastos realizados
            </div>
            <div className="stat-card-value is-expense">
              <MoneyDisplay cents={BigInt(summary.totalExpenseInCents)} tone="expense" />
            </div>
            <div className="stat-card-hint is-expense">realizado no período</div>
          </article>
          <article className="stat-card is-balance">
            <div className="stat-card-label">
              <span className="planning-card-icon is-balance" aria-hidden>
                <BarChart3 size={16} />
              </span>
              Saldo realizado
            </div>
            <div className={`stat-card-value${summary.balanceInCents.startsWith('-') ? ' is-expense' : ' is-income'}`}>
              <MoneyDisplay
                cents={BigInt(summary.balanceInCents)}
                tone={summary.balanceInCents.startsWith('-') ? 'expense' : 'income'}
              />
            </div>
            <div className="stat-card-hint">receitas − gastos</div>
          </article>
        </div>
      ) : null}

      <section className="panel lancamentos-filters">
        <div className="lancamentos-filters-grid">
          <Input
            label="Buscar lançamento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lançamento..."
          />
          <label className="lancamentos-filter-field">
            <span>Tipo</span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
            >
              <option value="all">Todos</option>
              <option value="income">Receitas</option>
              <option value="expense">Gastos</option>
            </select>
          </label>
          <label className="lancamentos-check">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={(e) => setIncludeVoided(e.target.checked)}
            />
            Incluir excluídos
          </label>
        </div>
      </section>

      {loading ? (
        <p>Carregando lançamentos…</p>
      ) : items.length === 0 ? (
        <section className="panel">
          <EmptyState
            title="Nenhum lançamento neste mês"
            description="Registre uma receita ou um gasto para acompanhar o realizado."
            action={
              canWrite ? (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link href={`/lancamentos/novo?ano=${year}&mes=${month}&tipo=income`}>
                    <Button variant="secondary">Nova receita</Button>
                  </Link>
                  <Link href={`/lancamentos/novo?ano=${year}&mes=${month}`}>
                    <Button>Novo lançamento</Button>
                  </Link>
                </div>
              ) : undefined
            }
          />
        </section>
      ) : (
        <section className="planning-table-panel lancamentos-table-panel">
          <div className="lancamentos-table-head">
            <span>Data</span>
            <span>Descrição</span>
            <span>Categoria</span>
            <span>Pessoa</span>
            <span>Valor</span>
            {canWrite ? <span>Ações</span> : null}
          </div>
          <ul className="lancamentos-table-list">
            {items.map((item) => {
              const category = categoryById.get(item.categoryId);
              return (
                <li
                  key={item.id}
                  className={`lancamentos-table-row${item.voidedAt ? ' is-voided' : ''}`}
                >
                  <span className="lancamentos-date">{formatDisplayDate(item.occurredOn)}</span>
                  <div className="lancamentos-desc">
                    <strong>{item.description}</strong>
                    {item.voidedAt ? <small>Excluído</small> : null}
                  </div>
                  <div className="lancamentos-category">
                    <CategoryIconBadge
                      icon={category?.icon ?? (item.kind === 'income' ? 'wallet' : 'shopping-cart')}
                      color={
                        category?.color ??
                        (item.kind === 'income' ? '#059669' : '#E11D48')
                      }
                      size={14}
                    />
                    <div>
                      <strong>{item.categoryName || '—'}</strong>
                      <small>{item.subcategoryName || '—'}</small>
                    </div>
                  </div>
                  <span>{item.attributedMemberName ?? '—'}</span>
                  <span
                    className={`lancamentos-amount${item.kind === 'income' ? ' is-income' : ' is-expense'}`}
                  >
                    {item.kind === 'expense' ? '−' : '+'}
                    {formatCentsToBRL(item.amountInCents).replace(/^R\$\s*/, 'R$ ')}
                  </span>
                  {canWrite ? (
                    <div className="lancamentos-actions">
                      {!item.voidedAt ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Editar ${item.description}`}
                            onClick={() => openEdit(item)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${item.description}`}
                            onClick={() => setVoidTarget(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Restaurar ${item.description}`}
                          onClick={() => void restoreEntry(item)}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="lancamentos-footer-links">
        <Link href={buildPlanningHref(year, month, 'gastos')}>Ver comparação no planejamento</Link>
        <Link href={`/lancamentos?ano=${prev.year}&mes=${prev.month}`}>Mês anterior</Link>
        <Link href={`/lancamentos?ano=${next.year}&mes=${next.month}`}>Próximo mês</Link>
      </div>

      {dialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? 'Editar lançamento' : 'Novo lançamento'}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 40,
            padding: '1rem',
          }}
        >
          <div
            className="panel"
            style={{ width: 'min(100%, 32rem)', maxHeight: '90vh', overflow: 'auto' }}
          >
            <h2 style={{ marginTop: 0 }}>{editing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Tipo</span>
                <select
                  value={form.kind}
                  disabled={Boolean(editing)}
                  onChange={(e) => updateForm({ kind: e.target.value as 'income' | 'expense' })}
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <Input
                label="Descrição"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
              />
              <MoneyInput
                label="Valor"
                valueInCents={form.amountInCents}
                onChange={(cents) => updateForm({ amountInCents: cents })}
              />
              <Input
                label="Data"
                type="date"
                value={form.occurredOn}
                onChange={(e) => updateForm({ occurredOn: e.target.value })}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Competência (mês)"
                    type="number"
                    min={1}
                    max={12}
                    value={form.competenceMonth}
                    onChange={(e) => updateForm({ competenceMonth: Number(e.target.value) })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Ano"
                    type="number"
                    min={2000}
                    max={2100}
                    value={form.competenceYear}
                    onChange={(e) => updateForm({ competenceYear: Number(e.target.value) })}
                  />
                </div>
              </div>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Categoria</span>
                <select
                  value={form.categoryId}
                  onChange={(e) => updateForm({ categoryId: e.target.value })}
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Selecione</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Subcategoria</span>
                <select
                  value={form.subcategoryId}
                  onChange={(e) => updateForm({ subcategoryId: e.target.value })}
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Selecione</option>
                  {filteredSubcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{form.kind === 'expense' ? 'Quem pagou?' : 'Quem recebeu?'}</span>
                <select
                  value={form.attributedMemberId}
                  onChange={(e) => updateForm({ attributedMemberId: e.target.value })}
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Não informado</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user?.name ?? m.name ?? m.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '1rem',
              }}
            >
              <Button
                variant="secondary"
                onClick={() =>
                  confirmIfDirty(() => {
                    setDialogOpen(false);
                    setDirty(false);
                  })
                }
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={() => void saveEntry()} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => void confirmVoid()}
        title="Excluir lançamento"
        description="Este lançamento deixará de entrar nos totais e comparações. O histórico será preservado."
        confirmLabel="Excluir lançamento"
        tone="danger"
        busy={saving}
      />
    </div>
  );
}
