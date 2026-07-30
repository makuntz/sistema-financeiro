'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Dialog, Input, Alert, Badge, EmptyState } from '@pp-planning/ui-web';
import { Users, UserPlus, Trash2, Mail, Clock } from 'lucide-react';
import { getPermissions, normalizeRole, ROLE_LABELS, type WorkspaceRole } from '@/lib/permissions';

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function PessoasPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentRole, setCurrentRole] = useState<WorkspaceRole>('viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviting, setInviting] = useState(false);

  const permissions = getPermissions(currentRole);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/bff/members').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/bff/invitations').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/bff/auth/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([mems, invs, me]) => {
        const rawMembers = Array.isArray(mems) ? mems : Array.isArray(mems?.data) ? mems.data : [];
        const memberList: Member[] = rawMembers.map(
          (
            item: Member & { member?: Member; user?: { id: string; name: string; email: string } },
          ) => {
            if (item.member && item.user) {
              return {
                id: item.member.id,
                userId: item.user.id,
                name: item.user.name,
                email: item.user.email,
                role: normalizeRole(item.member.role),
              };
            }
            return {
              ...item,
              role: normalizeRole(item.role),
            };
          },
        );
        setMembers(memberList);
        setInvitations(Array.isArray(invs) ? invs : Array.isArray(invs?.data) ? invs.data : []);

        const userId = me?.user?.id ?? me?.id;
        if (userId) {
          const myMembership = memberList.find((m) => m.userId === userId);
          if (myMembership) setCurrentRole(normalizeRole(myMembership.role));
        }
      })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    try {
      const res = await fetch('/api/bff/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Erro ao convidar');
        return;
      }
      setShowInvite(false);
      setInviteEmail('');
      fetchData();
    } catch {
      setError('Erro de conexão');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    await fetch(`/api/bff/invitations/${invitationId}/revoke`, { method: 'POST' });
    fetchData();
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remover este membro?')) return;
    await fetch(`/api/bff/members/${memberId}`, { method: 'DELETE' });
    fetchData();
  }

  async function handleChangeRole(memberId: string, role: string) {
    await fetch(`/api/bff/members/${memberId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    fetchData();
  }

  async function handleLeave() {
    if (!confirm('Você perderá acesso a este planejamento. Continuar?')) return;
    await fetch('/api/bff/workspaces/current/leave', { method: 'POST' });
    window.location.href = '/inicio';
  }

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h1>Pessoas e acesso</h1>
          <p>Carregando membros e convites…</p>
        </div>
      </div>
    );
  }

  const pendingInvitations = invitations.filter(
    (i) => i.status === 'PENDING' || i.status === 'pending',
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pessoas e acesso</h1>
          <p>Gerencie quem participa deste planejamento e os papéis de cada pessoa.</p>
        </div>
        <div className="page-actions">
          {permissions.canInvite && (
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus size={16} /> Convidar pessoa
            </Button>
          )}
          <Button variant="secondary" onClick={handleLeave}>
            Sair do planejamento
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" style={{ marginBottom: '1rem' }}>
          {error}
        </Alert>
      )}

      {/* Members */}
      <Card title="Membros" style={{ marginBottom: '1.5rem' }}>
        {members.length === 0 ? (
          <EmptyState icon={<Users size={32} />} title="Nenhum membro" />
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--border-default)',
                }}
              >
                <div
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: 'var(--action-primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {m.email}
                  </div>
                </div>
                {permissions.canChangeRoles && normalizeRole(m.role) !== 'owner' ? (
                  <select
                    value={normalizeRole(m.role)}
                    onChange={(e) => handleChangeRole(m.id, e.target.value)}
                    style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      background: 'var(--surface-default)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {permissions.canPromoteOwner ? (
                      <option value="owner">Proprietário</option>
                    ) : null}
                    <option value="admin">Administrador</option>
                    <option value="member">Membro</option>
                    <option value="viewer">Somente leitura</option>
                  </select>
                ) : (
                  <Badge>{ROLE_LABELS[normalizeRole(m.role)]}</Badge>
                )}
                {permissions.canRemoveMembers && normalizeRole(m.role) !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--status-danger)',
                    }}
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card title="Convites pendentes">
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border-default)',
                }}
              >
                <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ flex: 1, fontSize: '0.875rem' }}>{inv.email}</span>
                <Badge variant="warning">
                  <Clock size={12} style={{ marginRight: '0.25rem' }} />
                  Pendente
                </Badge>
                {permissions.canInvite && (
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--status-danger)',
                      fontSize: '0.75rem',
                    }}
                  >
                    Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onClose={() => setShowInvite(false)} title="Convidar pessoa">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <label style={{ display: 'grid', gap: '0.35rem', fontFamily: 'var(--font-sans)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Papel</span>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.625rem 0.75rem',
                fontFamily: 'var(--font-sans)',
                background: 'var(--surface-default)',
                color: 'var(--text-primary)',
              }}
            >
              {permissions.canPromoteOwner ? <option value="owner">Proprietário</option> : null}
              <option value="admin">Administrador</option>
              <option value="member">Membro</option>
              <option value="viewer">Somente leitura</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
