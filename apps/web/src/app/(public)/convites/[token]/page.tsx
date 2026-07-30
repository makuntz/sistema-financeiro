'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Alert, Card, Skeleton } from '@pp-planning/ui-web';

type InvitePreview = {
  workspaceName: string;
  inviterName: string;
  email: string;
  role: string;
  expiresAt?: string;
  expired?: boolean;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/bff/invitations/preview/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error ?? data.message ?? 'Convite não encontrado');
        } else {
          setPreview(data);
        }
      })
      .catch(() => setError('Erro ao carregar convite'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/bff/invitations/${token}/accept`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/cadastro?next=/convites/${token}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao aceitar convite');
        return;
      }
      router.push('/inicio');
      router.refresh();
    } catch {
      setError('Erro de conexão');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline() {
    setActionLoading(true);
    try {
      await fetch(`/api/bff/invitations/${token}/decline`, { method: 'POST' });
      router.push('/login');
    } catch {
      setError('Erro de conexão');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <Card style={{ width: '100%', maxWidth: '24rem' }}>
          <Skeleton height="1.5rem" width="60%" />
          <Skeleton height="1rem" style={{ marginTop: '1rem' }} />
          <Skeleton height="1rem" style={{ marginTop: '0.5rem' }} />
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <Card style={{ width: '100%', maxWidth: '24rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
          }}
        >
          Convite para planejamento
        </h1>

        {error && (
          <Alert variant="danger" style={{ marginBottom: '1rem' }}>
            {error}
          </Alert>
        )}

        {preview && !preview.expired && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              <strong>{preview.inviterName}</strong> convidou você para participar do planejamento{' '}
              <strong>{preview.workspaceName}</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Email do convite: {preview.email}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button onClick={handleAccept} disabled={actionLoading} style={{ flex: 1 }}>
                Aceitar
              </Button>
              <Button
                variant="secondary"
                onClick={handleDecline}
                disabled={actionLoading}
                style={{ flex: 1 }}
              >
                Recusar
              </Button>
            </div>
          </>
        )}

        {preview?.expired && (
          <Alert variant="warning">Este convite expirou. Solicite um novo convite ao administrador.</Alert>
        )}
      </Card>
    </div>
  );
}
