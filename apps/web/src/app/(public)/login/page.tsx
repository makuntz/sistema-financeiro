'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Button, PasswordInput, Alert, Card } from '@pp-planning/ui-web';
import { useTheme } from '../../../components/theme-provider';
import { Moon, Sun } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/bff/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Não foi possível entrar. Verifique seus dados.');
        return;
      }

      router.push('/inicio');
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          border: '1px solid var(--border-default)',
          background: 'var(--surface-default)',
          color: 'var(--text-primary)',
          borderRadius: '999px',
          width: '2.5rem',
          height: '2.5rem',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <Card style={{ width: 'min(100%, 26rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            aria-hidden
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '999px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(160deg, #3b82f6, #1d4ed8)',
              color: 'white',
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>PP Planning</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              SUA VIDA. SEU PLANO.
            </div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.55rem', letterSpacing: '-0.03em' }}>
          Acesse seu planejamento
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.35rem' }}>
          Entre com seu e-mail e senha para continuar.
        </p>

        {error ? (
          <div aria-live="polite" style={{ marginBottom: '1rem' }}>
            <Alert variant="danger">{error}</Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="E-mail"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <PasswordInput
            label="Senha"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p style={{ marginTop: '1.35rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Não tem conta?{' '}
          <a href="/cadastro" style={{ color: 'var(--action-primary)', textDecoration: 'none', fontWeight: 600 }}>
            Criar conta
          </a>
        </p>
      </Card>
    </div>
  );
}
