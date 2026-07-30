# @pp-planning/web

Aplicação web (Next.js App Router).

Nesta etapa: página de **diagnóstico** (`/`) que valida conexão com a API e link para Swagger. Autenticação e seleção de workspace na UI ficam para etapas posteriores.

## Preparação (api-client)

O cliente HTTP já suporta `getAccessToken` e `getWorkspaceId` em `src/lib/api.ts`. Quando a UI de auth existir, injete:

- token JWT após login/register;
- `X-Workspace-Id` do workspace selecionado (listagem `GET /v1/workspaces`).

Não é necessário alterar rotas da API — apenas configurar os providers do `createApiClient`.
