# Fluxo de autenticação

Autenticação da etapa 2: JWT de acesso curto + refresh opaco com rotação.

```mermaid
sequenceDiagram
  autonumber
  participant C as Cliente (web/mobile)
  participant API as API Fastify
  participant DB as PostgreSQL

  Note over C,DB: Cadastro ou login
  C->>API: POST /v1/auth/register ou /login
  API->>DB: Criar/validar User + AuthSession (refresh hash)
  API-->>C: accessToken (JWT) + refreshToken (opaco)

  Note over C,DB: Requisição autenticada
  C->>API: Authorization: Bearer accessToken<br/>X-Workspace-Id (se aplicável)
  API->>API: Verificar JWT (sub, sid)
  API->>DB: Buscar sessão por sid — ativa?
  API->>DB: Validar membership (workspace)
  API-->>C: 200 + dados

  Note over C,DB: Renovação (rotação)
  C->>API: POST /v1/auth/refresh { refreshToken }
  API->>DB: Hash token → sessão atual
  API->>DB: Revogar sessão anterior + criar nova
  API-->>C: Novo accessToken + refreshToken

  Note over C,DB: Logout
  C->>API: POST /v1/auth/logout { refreshToken }
  API->>DB: Revogar sessão
  API-->>C: 204
```

## Endpoints

| Método | Rota                | Auth   | Descrição                              |
| ------ | ------------------- | ------ | -------------------------------------- |
| POST   | `/v1/auth/register` | —      | Cadastro + workspace pessoal + tokens  |
| POST   | `/v1/auth/login`    | —      | Login + tokens                         |
| POST   | `/v1/auth/refresh`  | —      | Rotaciona refresh e emite novos tokens |
| POST   | `/v1/auth/logout`   | —      | Revoga sessão do refresh informado     |
| GET    | `/v1/auth/me`       | Bearer | Dados do usuário autenticado           |

## Detalhes

- Access token: JWT HS256, claims `sub` (userId) e `sid` (sessionId).
- Refresh token: 64 caracteres hex; apenas SHA-256 persistido.
- Após refresh, o refresh token **anterior** invalida imediatamente.

Ver [ADR-009](../adr/ADR-009-auth-tokens-jwt-and-opaque-refresh.md) e [ADR-012](../adr/ADR-012-refresh-token-rotation.md).
