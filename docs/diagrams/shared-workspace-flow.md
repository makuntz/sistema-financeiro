# Fluxo de workspace compartilhado

Visão de alto nível: User A convida User B para o mesmo workspace e ambos acessam dados compartilhados.

```mermaid
flowchart LR
  subgraph Users
    UA[User A<br/>login próprio]
    UB[User B<br/>login próprio]
  end

  subgraph Workspace
    WS[(Workspace<br/>Planejamento Familiar)]
    M1[Membership A — owner]
    M2[Membership B — member/owner]
    DATA[(Categorias, lançamentos…<br/>workspaceId)]
  end

  INV[Convite<br/>token + link]

  UA -->|cria ou possui| WS
  UA --> M1
  M1 --> WS
  UA -->|POST invitations| INV
  INV -->|invitationLink| UB
  UB -->|POST accept| M2
  M2 --> WS
  UA -->|X-Workspace-Id| DATA
  UB -->|X-Workspace-Id| DATA

  style WS fill:#e8f4fc
  style DATA fill:#f0f8e8
```

## Sequência resumida

```mermaid
sequenceDiagram
  participant A as User A (owner)
  participant API as API
  participant WS as Workspace
  participant B as User B

  A->>API: POST /v1/workspaces (opcional) ou usa workspace existente
  API->>WS: Cria / seleciona workspace
  A->>API: POST .../invitations { email de B, role }
  API-->>A: invitationLink
  Note over A,B: Link copiado manualmente (e-mail futuro)
  B->>API: POST /v1/auth/register ou login
  B->>API: POST /v1/invitations/:token/accept
  API->>WS: Cria membership de B
  B->>API: GET /v1/categories + X-Workspace-Id
  A->>API: GET /v1/categories + X-Workspace-Id
  Note over A,B: Mesmos dados — workspaceId igual
```

## Princípios

- **Sem conta conjunta**: A e B são usuários distintos.
- **Dados no workspace**: propriedade lógica via `workspaceId`.
- **Contexto por header**: cada cliente envia `X-Workspace-Id` do workspace compartilhado.
- **Múltiplos owners**: B pode ser convidado/promovido a `owner`.

Ver [ADR-013](../adr/ADR-013-shared-workspaces-and-invitations.md).
