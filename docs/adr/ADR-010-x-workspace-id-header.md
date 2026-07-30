# ADR-010: Header X-Workspace-Id

## Status

Aceito

## Contexto

Usuários podem pertencer a múltiplos workspaces. Rotas de domínio (`/v1/categories`, `/v1/workspaces/current/*`) precisam saber **qual** workspace está em uso na requisição, sem confiar em campos do body enviados pelo cliente.

## Decisão

Exigir o header HTTP **`X-Workspace-Id: <uuid>`** em rotas que operam no contexto de um workspace (middleware `requireWorkspace`).

Resolução:

1. Após autenticação JWT, ler `X-Workspace-Id`.
2. Buscar `WorkspaceMember` ativo para `(workspaceId, userId)`.
3. Popular `request.workspace` com `workspaceId`, `membershipId`, `role` e lista de `permissions`.
4. Rejeitar body com `workspaceId` extra (schemas Zod `.strict()`).

Rotas **sem** workspace header: auth (`/v1/auth/*`), listagem de workspaces (`GET /v1/workspaces`), criação de workspace (`POST /v1/workspaces`), preview/aceite de convite por token.

## Alternativas consideradas

- `workspaceId` no path (`/v1/workspaces/:id/categories`) — mais verboso; adotável depois
- Workspace “ativo” na sessão server-side — acopla estado; dificulta multi-tab
- Inferir único workspace do usuário — quebra com multi-workspace real

## Consequências positivas

- Explícito e testável (OpenAPI/Swagger)
- Cliente pode alternar workspace sem novo login
- Alinhado ao `@pp-planning/api-client` (`getWorkspaceId`)

## Consequências negativas

- Cliente deve gerenciar workspace selecionado localmente
- Esquecer o header gera `400 WORKSPACE_REQUIRED`
- ID inválido ou sem membership gera `403 WORKSPACE_ACCESS_DENIED`
