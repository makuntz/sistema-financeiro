'use client';

import {
  LayoutDashboard,
  CalendarRange,
  Receipt,
  ArrowUpCircle,
  ShoppingCart,
  ArrowLeftRight,
  CreditCard,
  BarChart3,
  Target,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Moon,
  Sun,
  Users,
  Tags,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './theme-provider';
import { useUnsavedChanges } from './unsaved-changes';

type User = { id: string; name: string; email: string };
type Workspace = { id: string; name: string; role: string };

type NavItem =
  | {
      type: 'link';
      href: string;
      label: string;
      icon: typeof LayoutDashboard;
      match?: (path: string) => boolean;
    }
  | { type: 'soon'; label: string; icon: typeof LayoutDashboard }
  | {
      type: 'group';
      label: string;
      icon: typeof Settings;
      children: Array<{ href: string; label: string; icon: typeof Tags }>;
    };

const NAV_ITEMS: NavItem[] = [
  { type: 'link', href: '/inicio', label: 'Resumo', icon: LayoutDashboard },
  { type: 'link', href: '/planejamento', label: 'Planejamento', icon: CalendarRange },
  {
    type: 'link',
    href: '/lancamentos',
    label: 'Lançamentos',
    icon: Receipt,
    match: (path) => path === '/lancamentos' || path.startsWith('/lancamentos/'),
  },
  { type: 'link', href: '/planejamento?aba=receitas', label: 'Receitas', icon: ArrowUpCircle },
  { type: 'link', href: '/planejamento?aba=gastos', label: 'Gastos', icon: ShoppingCart },
  { type: 'soon', label: 'Transferências', icon: ArrowLeftRight },
  { type: 'soon', label: 'Parcelas', icon: CreditCard },
  { type: 'soon', label: 'Relatórios', icon: BarChart3 },
  { type: 'soon', label: 'Metas', icon: Target },
  {
    type: 'group',
    label: 'Configurações',
    icon: Settings,
    children: [
      { href: '/configuracoes/categorias', label: 'Categorias', icon: Tags },
      { href: '/configuracoes/pessoas', label: 'Pessoas e acesso', icon: Users },
    ],
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function isNavActive(pathname: string, item: Extract<NavItem, { type: 'link' }>, search: string) {
  if (item.match) return item.match(pathname);
  if (item.href.includes('?')) {
    const [path, query] = item.href.split('?');
    if (pathname !== path) return false;
    const wanted = new URLSearchParams(query).get('aba');
    const current = new URLSearchParams(search).get('aba');
    return wanted === current || (wanted === 'resumo' && !current);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { confirmIfDirty, isDirty } = useUnsavedChanges();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/configuracoes'));
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSettingsOpen(pathname.startsWith('/configuracoes'));
    setSidebarOpen(false);
    setSearch(typeof window !== 'undefined' ? window.location.search : '');
  }, [pathname]);

  useEffect(() => {
    fetch('/api/bff/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
        else if (data?.id) setUser(data);
      })
      .catch(() => undefined);

    fetch('/api/bff/workspaces')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        const normalized = list.map(
          (item: { id?: string; workspace?: Workspace; name?: string; role?: string }) =>
            item.workspace
              ? item.workspace
              : {
                  id: item.id ?? '',
                  name: item.name ?? 'Planejamento',
                  role: item.role ?? 'member',
                },
        ) as Workspace[];
        setWorkspaces(normalized.filter((ws) => ws.id));
        if (normalized[0]) setCurrentWorkspace(normalized[0]);
      })
      .catch(() => undefined);
  }, []);

  async function handleLogout() {
    await fetch('/api/bff/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function navigate(href: string) {
    confirmIfDirty(() => {
      router.push(href);
    });
  }

  const userInitials = useMemo(() => initials(user?.name ?? 'PP'), [user?.name]);

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-btn"
        aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="mobile-backdrop"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className={`app-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark" aria-hidden>
            P
          </div>
          <div>
            <div className="brand-title">PP Planning</div>
            <div className="brand-tagline">SUA VIDA. SEU PLANO.</div>
          </div>
        </div>

        {currentWorkspace ? (
          <div className="workspace-chip" title={currentWorkspace.name}>
            <span className="workspace-chip-label">Planejamento</span>
            <strong>{currentWorkspace.name}</strong>
            {workspaces.length > 1 ? (
              <select
                aria-label="Trocar planejamento"
                className="workspace-select"
                value={currentWorkspace.id}
                onChange={(event) => {
                  const next = workspaces.find((ws) => ws.id === event.target.value);
                  if (!next) return;
                  confirmIfDirty(async () => {
                    await fetch('/api/bff/workspaces/select', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ workspaceId: next.id }),
                    });
                    setCurrentWorkspace(next);
                    router.refresh();
                  });
                }}
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}

        <nav className="sidebar-nav" aria-label="Principal">
          {NAV_ITEMS.map((item) => {
            if (item.type === 'soon') {
              return (
                <div key={item.label} className="nav-item is-soon" title="Em breve">
                  <item.icon size={16} aria-hidden />
                  <span>{item.label}</span>
                  <span className="soon-badge">Em breve</span>
                </div>
              );
            }

            if (item.type === 'group') {
              const groupActive = item.children.some(
                (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
              );
              return (
                <div key={item.label} className="nav-group">
                  <button
                    type="button"
                    className={`nav-item ${groupActive ? 'is-active' : ''}`}
                    onClick={() => setSettingsOpen((open) => !open)}
                    aria-expanded={settingsOpen}
                  >
                    <item.icon size={16} aria-hidden />
                    <span>{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={`nav-chevron ${settingsOpen ? 'is-open' : ''}`}
                    />
                  </button>
                  {settingsOpen
                    ? item.children.map((child) => {
                        const active =
                          pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`nav-item nav-subitem ${active ? 'is-active' : ''}`}
                            onClick={(event) => {
                              if (!isDirty) return;
                              event.preventDefault();
                              navigate(child.href);
                            }}
                          >
                            <child.icon size={14} aria-hidden />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })
                    : null}
                </div>
              );
            }

            const active = isNavActive(pathname, item, search);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? 'is-active' : ''}`}
                onClick={(event) => {
                  if (!isDirty) return;
                  event.preventDefault();
                  navigate(item.href);
                }}
              >
                    <item.icon size={16} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>
          </button>

          <div className="user-chip">
            <div className="user-avatar" aria-hidden>
              {userInitials || 'PP'}
            </div>
            <div className="user-meta">
              <strong>{user?.name?.split(' ')[0] ?? '...'}</strong>
              <span>Perfil</span>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout} aria-label="Sair">
              <LogOut size={16} />
            </button>
            <ChevronRight size={16} className="user-chevron" aria-hidden />
          </div>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
