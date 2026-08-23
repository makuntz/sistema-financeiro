'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, MoneyInput } from '@pp-planning/ui-web';
import { formatCentsToBRL } from '@pp-planning/contracts';
import { Car, Check, Fuel, Heart, Paperclip, Plus, ShoppingCart, Star } from 'lucide-react';
import { CategoryIconBadge } from '@/lib/category-icons';
import { getPermissions, normalizeRole } from '@/lib/permissions';
import {
  formatMonthTitle,
  getSaoPauloYearMonth,
  parsePlanningSearchParams,
} from '@/lib/planning-period';
import { usagePercent } from '@/features/planning/planning-metrics';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  isActive: boolean;
  subcategories?: Array<{ id: string; name: string; isActive: boolean }>;
};

type ComparisonCategory = {
  categoryId: string;
  categoryName: string;
  kind: 'income' | 'expense';
  plannedInCents: string;
  realizedInCents: string;
  subcategories: Array<{
    subcategoryId: string;
    plannedInCents: string;
    realizedInCents: string;
  }>;
};

type RecentEntry = {
  id: string;
  description: string;
  amountInCents: string;
  occurredOn: string;
  subcategoryId: string;
};

const QUICK_ENTRIES = [
  {
    id: 'mercado',
    label: 'Mercado',
    icon: ShoppingCart,
    color: '#059669',
    match: /mercado|mantimento/i,
  },
  {
    id: 'combustivel',
    label: 'Combustível',
    icon: Fuel,
    color: '#EA580C',
    match: /combust|gasolina|transporte/i,
  },
  { id: 'saude', label: 'Saúde', icon: Heart, color: '#16A34A', match: /sa[uú]de/i },
  { id: 'lazer', label: 'Lazer', icon: Star, color: '#7C3AED', match: /lazer|hobby/i },
  {
    id: 'transporte',
    label: 'Transporte',
    icon: Car,
    color: '#2563EB',
    match: /transporte|uber|carro/i,
  },
] as const;

const PAYMENT_METHODS = ['Pix', 'Crédito', 'Débito'];
const BANKS = ['Itaú', 'Nubank', 'Bradesco', 'Banco do Brasil', 'C6 Bank', 'XP', 'Carteira'];

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

export function NovoLancamentoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(
    () => parsePlanningSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [comparison, setComparison] = useState<ComparisonCategory[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [role, setRole] = useState('viewer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [kind, setKind] = useState<'income' | 'expense'>(
    searchParams.get('tipo') === 'income' ? 'income' : 'expense',
  );
  const [occurredOn, setOccurredOn] = useState(todayDateOnly());
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Crédito');
  const [bank, setBank] = useState('Itaú');
  const [installment, setInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [amountInCents, setAmountInCents] = useState('0');
  const [notes, setNotes] = useState('');

  const canWrite = getPermissions(role).canWriteLedger;
  const year = Number(occurredOn.slice(0, 4)) || parsed.year;
  const month = Number(occurredOn.slice(5, 7)) || parsed.month;

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
        setRole(normalizeRole(first?.role ?? first?.workspace?.role ?? 'viewer'));
      })
      .catch(() => undefined);

    fetch('/api/bff/categories')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setCategories(list as Category[]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch(`/api/bff/reports/monthly-budget/${year}/${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setComparison((data?.categories as ComparisonCategory[]) ?? []))
      .catch(() => undefined);

    fetch(
      `/api/bff/ledger/entries?competenceYear=${year}&competenceMonth=${month}&page=1&pageSize=20`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const entries = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        setRecent(entries as RecentEntry[]);
      })
      .catch(() => undefined);
  }, [year, month]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === kind && c.isActive),
    [categories, kind],
  );

  const selectedCategory = filteredCategories.find((c) => c.id === categoryId);
  const subcategories = (selectedCategory?.subcategories ?? []).filter((s) => s.isActive);
  const selectedSub = subcategories.find((s) => s.id === subcategoryId);

  const impact = useMemo(() => {
    const cat = comparison.find((c) => c.categoryId === categoryId);
    const sub = cat?.subcategories.find((s) => s.subcategoryId === subcategoryId);
    const planned = sub?.plannedInCents ?? cat?.plannedInCents ?? '0';
    const realized = sub?.realizedInCents ?? cat?.realizedInCents ?? '0';
    const after = (BigInt(realized) + BigInt(amountInCents || '0')).toString();
    const available = (BigInt(planned) - BigInt(after)).toString();
    return {
      planned,
      realized,
      after,
      available,
      percentNow: usagePercent(planned, realized),
      percentAfter: usagePercent(planned, after),
      label: selectedSub?.name
        ? `${selectedCategory?.name ?? 'Categoria'} / ${selectedSub.name}`
        : (selectedCategory?.name ?? 'Selecione uma categoria'),
    };
  }, [comparison, categoryId, subcategoryId, amountInCents, selectedCategory, selectedSub]);

  const similar = recent.filter((entry) => entry.subcategoryId === subcategoryId).slice(0, 3);

  function applyQuick(match: RegExp) {
    const cat = filteredCategories.find((c) => match.test(c.name));
    if (!cat) return;
    setCategoryId(cat.id);
    const firstSub = (cat.subcategories ?? []).find((s) => s.isActive);
    setSubcategoryId(firstSub?.id ?? '');
  }

  async function save(andNew: boolean) {
    if (!canWrite) return;
    if (!notes.trim() || !subcategoryId || amountInCents === '0') {
      setError('Preencha valor, subcategoria e observações.');
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const descriptionParts = [notes.trim()];
      if (paymentMethod) descriptionParts.push(`Pagamento: ${paymentMethod}`);
      if (bank) descriptionParts.push(`Banco: ${bank}`);
      if (installment) descriptionParts.push(`Parcelado: ${installmentCount}x`);

      const res = await fetch('/api/bff/ledger/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: descriptionParts.join(' · '),
          amountInCents,
          occurredOn,
          competenceYear: year,
          competenceMonth: month,
          subcategoryId,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? body?.error ?? 'Não foi possível salvar o lançamento.');
        return;
      }
      if (andNew) {
        setAmountInCents('0');
        setNotes('');
        setStatus('Lançamento salvo. Pode cadastrar outro.');
      } else {
        router.push(`/lancamentos?ano=${year}&mes=${month}`);
      }
    } catch {
      setError('Erro de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="novo-lancamento-page">
      <div className="breadcrumb">Lançamentos / Novo lançamento</div>
      <header className="page-header">
        <div>
          <h1>Novo Lançamento</h1>
          <p>Cadastre um novo lançamento manualmente.</p>
        </div>
        <div className="page-actions">
          <Link href={`/lancamentos?ano=${year}&mes=${month}`}>
            <Button variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {status ? <Alert variant="success">{status}</Alert> : null}

      <div className="novo-lancamento-layout">
        <section className="panel">
          <h2>Dados do lançamento</h2>

          <div className="quick-entry-row" aria-label="Lançamento rápido">
            <span className="quick-entry-label">Lançamento rápido</span>
            <div className="quick-entry-chips">
              {QUICK_ENTRIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-entry-chip"
                  style={{ color: item.color }}
                  onClick={() => {
                    setKind('expense');
                    applyQuick(item.match);
                  }}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="novo-form-grid">
            <label>
              <span>Tipo</span>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as 'income' | 'expense');
                  setCategoryId('');
                  setSubcategoryId('');
                }}
              >
                <option value="expense">Gasto</option>
                <option value="income">Receita</option>
              </select>
            </label>

            <label>
              <span>Data</span>
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </label>

            <label>
              <span>Categoria</span>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId('');
                }}
              >
                <option value="">Selecione</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Subcategoria</span>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={!categoryId}
              >
                <option value="">Selecione</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Forma de pagamento</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Banco</span>
              <select value={bank} onChange={(e) => setBank(e.target.value)}>
                {BANKS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="radio-fieldset">
              <legend>Parcelado?</legend>
              <label>
                <input type="radio" checked={!installment} onChange={() => setInstallment(false)} />{' '}
                Não
              </label>
              <label>
                <input type="radio" checked={installment} onChange={() => setInstallment(true)} />{' '}
                Sim
              </label>
            </fieldset>

            <label>
              <span>Parcelas</span>
              <div className="parcelas-row">
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={installmentCount}
                  disabled={!installment}
                  onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)}
                />
                <span>x de</span>
                <input
                  disabled
                  value={
                    installment && Number(amountInCents) > 0
                      ? formatCentsToBRL(
                          String(Math.round(Number(amountInCents) / Math.max(installmentCount, 1))),
                        )
                      : '—'
                  }
                />
              </div>
            </label>

            <div className="valor-field">
              <MoneyInput
                label="Valor *"
                valueInCents={amountInCents}
                onChange={setAmountInCents}
              />
            </div>

            <label className="full-span">
              <span>Observações</span>
              <textarea
                maxLength={200}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descreva o lançamento"
              />
              <small className="char-count">{notes.length}/200</small>
            </label>

            <div className="attachment-drop full-span" aria-hidden>
              <Paperclip size={18} />
              <div>
                <strong>Anexo (opcional)</strong>
                <p>Arraste e solte arquivos aqui ou selecione. JPG, PNG, PDF · máx. 5MB</p>
              </div>
            </div>
          </div>

          <div className="novo-form-actions">
            <Button
              variant="secondary"
              disabled={saving || !canWrite}
              onClick={() => void save(true)}
            >
              <Plus size={16} /> Salvar e novo
            </Button>
            <Button disabled={saving || !canWrite} onClick={() => void save(false)}>
              <Check size={16} /> {saving ? 'Salvando…' : 'Salvar lançamento'}
            </Button>
          </div>
        </section>

        <aside className="novo-side-column">
          <section className="panel">
            <h2>Impacto no planejamento</h2>
            <div className="impact-header">
              <CategoryIconBadge
                icon={selectedCategory?.icon}
                color={selectedCategory?.color}
                size={16}
              />
              <div>
                <strong>{impact.label}</strong>
                <span>{formatMonthTitle(year, month)}</span>
              </div>
            </div>

            <div className="planning-usage-cell" style={{ margin: '0.85rem 0' }}>
              <div className="planning-progress-track">
                <div
                  className={`planning-progress-fill${impact.percentAfter > 100 ? ' is-over' : ''}`}
                  style={{ width: `${Math.min(impact.percentAfter, 100)}%` }}
                />
              </div>
              <span className="planning-usage-pct">
                {impact.percentAfter.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                utilizado
              </span>
            </div>

            <dl className="impact-stats">
              <div>
                <dt>Limite da categoria</dt>
                <dd>{formatCentsToBRL(impact.planned)}</dd>
              </div>
              <div>
                <dt>Total utilizado (atual)</dt>
                <dd>{formatCentsToBRL(impact.realized)}</dd>
              </div>
              <div>
                <dt>Este lançamento</dt>
                <dd className="is-expense">{formatCentsToBRL(amountInCents || '0')}</dd>
              </div>
              <div>
                <dt>Total após lançamento</dt>
                <dd>
                  <strong>{formatCentsToBRL(impact.after)}</strong>
                </dd>
              </div>
            </dl>

            <div
              className={`impact-balance${impact.available.startsWith('-') ? ' is-danger' : ''}`}
            >
              Saldo disponível após lançamento: {formatCentsToBRL(impact.available)}
            </div>
          </section>

          <section className="panel">
            <h2>Lançamentos similares recentes</h2>
            {similar.length === 0 ? (
              <p className="muted-copy">Selecione uma subcategoria para ver similares.</p>
            ) : (
              <ul className="similar-list">
                {similar.map((entry) => (
                  <li key={entry.id}>
                    <span>{formatDisplayDate(entry.occurredOn)}</span>
                    <strong>{formatCentsToBRL(entry.amountInCents)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className={`smart-tip${impact.available.startsWith('-') ? ' is-danger' : ''}`}>
            {impact.available.startsWith('-')
              ? 'Este lançamento estoura o limite orçado para esta categoria.'
              : 'Você está dentro do limite orçado para esta categoria.'}
          </div>
        </aside>
      </div>
    </div>
  );
}
