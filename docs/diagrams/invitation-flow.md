# Fluxo de convite

Ciclo de vida completo de um convite de workspace.

```mermaid
stateDiagram-v2
  [*] --> pending: CreateInvitation
  pending --> accepted: accept (e-mail match)
  pending --> declined: decline (e-mail match)
  pending --> revoked: revoke (owner/admin)
  pending --> expired: expiresAt passou
  expired --> revoked: revoke (opcional)
  accepted --> [*]
  declined --> [*]
  revoked --> [*]
  expired --> [*]
```

Status **derivado** de timestamps (`acceptedAt`, `declinedAt`, `revokedAt`, `expiresAt`) — ver domínio `WorkspaceInvitation.status()`.

## Sequência detalhada

```mermaid
sequenceDiagram
  autonumber
  participant O as Owner/Admin
  participant API as API
  participant DB as DB
  participant G as Convidado

  O->>API: POST /v1/workspaces/current/invitations<br/>{ email, role } + X-Workspace-Id
  API->>DB: Revoga pending anterior (mesmo e-mail) se houver
  API->>DB: Persiste convite (tokenHash, expiresAt +7d)
  API-->>O: invitation + invitationLink<br/>(envio e-mail: futuro)

  G->>API: GET /v1/invitations/:token (público)
  API-->>G: preview (workspaceName, role, status, e-mail mascarado)

  alt Convidado sem conta
    G->>API: POST /v1/auth/register (mesmo e-mail)
  else Já possui conta
    G->>API: POST /v1/auth/login
  end

  G->>API: POST /v1/invitations/:token/accept + Bearer
  API->>API: normalizedEmail convidado = convite?
  alt E-mail diverge
    API-->>G: 403 INVITATION_EMAIL_MISMATCH
  else OK
    API->>DB: acceptedAt + WorkspaceMember
    API-->>G: workspaceId, membershipId
  end

  opt Recusar
    G->>API: POST /v1/invitations/:token/decline
    API->>DB: declinedAt
  end

  opt Revogar (antes de aceitar)
    O->>API: POST .../invitations/:id/revoke
    API->>DB: revokedAt
  end
```

## Validações principais

| Etapa | Regra |
|-------|--------|
| Criar | E-mail não pode já ser membro ativo |
| Criar | Admin não convida owner/admin |
| Aceitar | Conta autenticada com e-mail do convite |
| Aceitar | Convite pending e não expirado |
| Preview | Token válido (hash encontrado) |

## E-mail (estratégia futura)

Nesta etapa a API **retorna** `invitationLink` uma vez na criação. Integração futura:

- Template transacional com link `{WEB_URL}/convites/{token}`
- Sem reexpor token raw em listagens (apenas hash no banco)
- Reenvio = novo convite (revoga pendente anterior)

Ver [ADR-013](../adr/ADR-013-shared-workspaces-and-invitations.md).
