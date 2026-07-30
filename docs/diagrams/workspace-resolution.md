# Resolução de workspace

Como a API determina o contexto de workspace em cada requisição.

```mermaid
flowchart TD
  A[Requisição HTTP] --> B{Authorization Bearer?}
  B -->|Não| U401[401 INVALID_ACCESS_TOKEN]
  B -->|Sim| C[Verificar JWT — sub, sid]
  C --> D{Sessão sid ativa?}
  D -->|Não| S401[401 SESSION_REVOKED]
  D -->|Sim| E{Rota exige workspace?}
  E -->|Não| OK[request.auth populado]
  E -->|Sim| F{X-Workspace-Id presente?}
  F -->|Não| W400[400 WORKSPACE_REQUIRED]
  F -->|Sim| G[Buscar WorkspaceMember ativo]
  G --> H{Membership existe?}
  H -->|Não| W403[403 WORKSPACE_ACCESS_DENIED]
  H -->|Sim| I[permissionsForRole]
  I --> J{requirePermission?}
  J -->|Falha| P403[403 INSUFFICIENT_PERMISSION]
  J -->|OK| OK2[request.workspace populado]

  style U401 fill:#fee
  style S401 fill:#fee
  style W400 fill:#ffe
  style W403 fill:#fee
  style P403 fill:#fee
  style OK fill:#efe
  style OK2 fill:#efe
```

## Rotas por contexto

### Sem `X-Workspace-Id`

- `/v1/auth/*`
- `GET /v1/workspaces` — lista memberships do usuário
- `POST /v1/workspaces` — cria workspace (caller vira owner)
- `GET /v1/invitations/:token` — preview público
- `POST /v1/invitations/:token/accept|decline` — exige auth, não workspace header

### Com `X-Workspace-Id` obrigatório

- `/v1/workspaces/current/*` (detalhe, membros, convites, leave)
- Rotas de domínio scoped (ex.: `/v1/categories`)

## Cliente

O `@pp-planning/api-client` injeta o header quando `getWorkspaceId()` retorna um UUID. O valor deve vir da listagem `GET /v1/workspaces` ou do workspace retornado no register.

Ver [ADR-010](../adr/ADR-010-x-workspace-id-header.md).
