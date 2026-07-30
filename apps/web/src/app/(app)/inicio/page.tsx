'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, EmptyState, MoneyDisplay } from '@pp-planning/ui-web';
import {
  CheckCircle2,
  Circle,
  Tags,
  Users,
  CalendarRange,
  ArrowRight,
  FolderTree,
  UserRound,
} from 'lucide-react';
import { buildPlanningHref, getSaoPauloYearMonth } from '@/lib/planning-period';

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  soon?: boolean;
};

type PlanningSummary = {
  exists: boolean;
  totals: {
    incomePlannedInCents: string;
    expensePlannedInCents: string;
    projectedBalanceInCents: string;
  };
};

export default function InicioPage() {
  const [userName, setUserName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [categoryCount, setCategoryCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [planning, setPlanning] = useState<PlanningSummary | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { year, month } = useMemo(() => getSaoPauloYearMonth(), []);
  const planningHref = buildPlanningHref(year, month, 'resumo');

  useEffect(() => {
    Promise.all([
      fetch('/api/bff/auth/me').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/bff/categories').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/bff/members').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/bff/workspaces').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/bff/planning/monthly/${year}/${month}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([userRes, categoriesRes, membersRes, workspacesRes, planningRes]) => {
        const name = userRes?.user?.name ?? userRes?.name ?? '';
        setUserName(name);

        const catArray = Array.isArray(categoriesRes)
          ? categoriesRes
          : Array.isArray(categoriesRes?.data)
            ? categoriesRes.data
            : [];
        const memArray = Array.isArray(membersRes)
          ? membersRes
          : Array.isArray(membersRes?.data)
            ? membersRes.data
            : [];
        const wsArray = Array.isArray(workspacesRes)
          ? workspacesRes
          : Array.isArray(workspacesRes?.data)
            ? workspacesRes.data
            : [];

        setCategoryCount(catArray.length);
        setMemberCount(memArray.length);
        const current = wsArray[0]?.workspace?.name ?? wsArray[0]?.name ?? 'Seu planejamento';
        setWorkspaceName(current);

        const planningSummary: PlanningSummary = planningRes
          ? {
              exists: Boolean(planningRes.exists),
              totals: planningRes.totals ?? {
                incomePlannedInCents: '0',
                expensePlannedInCents: '0',
                projectedBalanceInCents: '0',
              },
            }
          : {
              exists: false,
              totals: {
                incomePlannedInCents: '0',
                expensePlannedInCents: '0',
                projectedBalanceInCents: '0',
              },
            };
        setPlanning(planningSummary);

        setChecklist([
          {
            id: 'categories',
            label: 'Configure categorias e subcategorias',
            done: catArray.length > 0,
            href: '/configuracoes/categorias',
          },
          {
            id: 'members',
            label: 'Convide alguém para compartilhar',
            done: memArray.length > 1,
            href: '/configuracoes/pessoas',
          },
          {
            id: 'planning',
            label: 'Crie seu primeiro planejamento mensal',
            done: planningSummary.exists,
            href: '/planejamento',
          },
        ]);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [year, month]);

  const greeting = useMemo(() => (userName ? `Olá, ${userName.split(' ')[0]}` : 'Olá'), [userName]);

  const balanceTone =
    BigInt(planning?.totals.projectedBalanceInCents || '0') >= 0n ? 'income' : 'expense';

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h1>Carregando…</h1>
          <p>Preparando o resumo do seu planejamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Resumo geral</h1>
          <p>
            {greeting}. Acompanhe a configuração do planejamento <strong>{workspaceName}</strong>.
          </p>
        </div>
        <div className="page-actions">
          <Link href={planningHref}>
            <Button variant="secondary">Abrir planejamento</Button>
          </Link>
          <Link href="/configuracoes/categorias">
            <Button variant="secondary">Configurar categorias</Button>
          </Link>
          <Link href="/configuracoes/pessoas">
            <Button>Convidar pessoa</Button>
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">
            <FolderTree size={16} />
            Categorias
          </div>
          <div className="stat-card-value">{categoryCount}</div>
          <div className="stat-card-hint">
            {categoryCount > 0 ? 'Estrutura pronta para evoluir' : 'Nenhuma categoria ainda'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            <UserRound size={16} />
            Pessoas
          </div>
          <div className="stat-card-value">{memberCount}</div>
          <div className="stat-card-hint">
            {memberCount > 1 ? 'Planejamento compartilhado' : 'Somente você por enquanto'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            <CalendarRange size={16} />
            Receitas previstas
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.15rem' }}>
            {planning?.exists ? (
              <MoneyDisplay
                cents={BigInt(planning.totals.incomePlannedInCents || '0')}
                tone="income"
              />
            ) : (
              '—'
            )}
          </div>
          <div className="stat-card-hint">Mês atual (São Paulo)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            <CalendarRange size={16} />
            Gastos previstos
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.15rem' }}>
            {planning?.exists ? (
              <MoneyDisplay
                cents={BigInt(planning.totals.expensePlannedInCents || '0')}
                tone="expense"
              />
            ) : (
              '—'
            )}
          </div>
          <div className="stat-card-hint">Mês atual (São Paulo)</div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card-label">
            <CalendarRange size={16} />
            Saldo projetado
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.15rem' }}>
            {planning?.exists ? (
              <MoneyDisplay
                cents={BigInt(planning.totals.projectedBalanceInCents || '0')}
                tone={balanceTone}
              />
            ) : (
              '—'
            )}
          </div>
          <div className="stat-card-hint">
            {planning?.exists ? (
              <Link href={planningHref}>Abrir planejamento</Link>
            ) : (
              <Link href={planningHref}>Crie seu planejamento deste mês</Link>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            <Tags size={16} />
            Próximo foco
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.05rem' }}>
            {categoryCount === 0
              ? 'Categorias'
              : !planning?.exists
                ? 'Planejamento'
                : memberCount < 2
                  ? 'Convites'
                  : 'Planejar'}
          </div>
          <div className="stat-card-hint">Siga o checklist ao lado</div>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>Prepare seu planejamento</h2>
          {checklist.length === 0 ? (
            <EmptyState title="Nenhuma tarefa" description="Tudo configurado por enquanto." />
          ) : (
            <ul className="checklist">
              {checklist.map((item) => (
                <li key={item.id}>
                  {item.done ? (
                    <CheckCircle2 size={20} color="var(--status-success)" />
                  ) : (
                    <Circle size={20} color="var(--text-secondary)" />
                  )}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        textDecoration: item.done ? 'line-through' : 'none',
                        opacity: item.done ? 0.7 : 1,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.soon ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Disponível em breve
                      </div>
                    ) : null}
                  </div>
                  {item.href && !item.done ? (
                    <Link href={item.href} aria-label={item.label}>
                      <ArrowRight size={18} color="var(--action-primary)" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Atalhos</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <Link href={planningHref} style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ boxShadow: 'none' }}>
                <div className="stat-card-label">
                  <CalendarRange size={16} />
                  Planejamento mensal
                </div>
                <div className="stat-card-hint">
                  {planning?.exists
                    ? 'Revise ou ajuste o mês atual'
                    : 'Crie seu planejamento deste mês'}
                </div>
              </div>
            </Link>
            <Link href="/configuracoes/categorias" style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ boxShadow: 'none' }}>
                <div className="stat-card-label">
                  <Tags size={16} />
                  Categorias e subcategorias
                </div>
                <div className="stat-card-hint">Organize gastos e receitas</div>
              </div>
            </Link>
            <Link href="/configuracoes/pessoas" style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ boxShadow: 'none' }}>
                <div className="stat-card-label">
                  <Users size={16} />
                  Pessoas e acesso
                </div>
                <div className="stat-card-hint">Convide e gerencie papéis</div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
