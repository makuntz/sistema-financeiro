'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button, PasswordInput, Alert, Card } from '@pp-planning/ui-web';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('A senha deve ter pelo menos 10 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/bff/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar conta');
        return;
      }

      const redirectTo = next && next.startsWith('/') && !next.startsWith('//') ? next : '/inicio';
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ width: 'min(100%, 26rem)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.1rem' }}
      >
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
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}
          >
            SUA VIDA. SEU PLANO.
          </div>
        </div>
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          marginBottom: '0.25rem',
          color: 'var(--text-primary)',
        }}
      >
        Criar conta
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Crie seu planejamento financeiro pessoal.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <Input
          label="Nome"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoFocus
        />
        <Input
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          label="Senha"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
        />
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          A senha deve ter pelo menos 10 caracteres.
        </p>
        <PasswordInput
          label="Confirmar senha"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={10}
        />

        {error ? (
          <div aria-live="polite">
            <Alert variant="danger">{error}</Alert>
          </div>
        ) : null}

        <Button type="submit" disabled={loading}>
          {loading ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>

      <p style={{ marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Já tem conta?{' '}
        <a href="/login" style={{ color: 'var(--action-primary)', textDecoration: 'none' }}>
          Entrar
        </a>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<Card style={{ width: 'min(100%, 26rem)' }}>Carregando…</Card>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
