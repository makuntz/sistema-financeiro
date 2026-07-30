# PP Planning

Sistema de planejamento financeiro pessoal e familiar (nome provisório).

Esta etapa entrega a **arquitetura inicial**: monorepo, monólito modular, pacotes compartilhados, API de exemplo (Taxonomy), fundação web/mobile, infraestrutura local e documentação.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Monorepo | pnpm workspaces + Turborepo |
| Linguagem | TypeScript (strict) |
| API | Node.js, Fastify, Zod, OpenAPI, Prisma |
| Banco | PostgreSQL |
| Arquivos (local) | MinIO (S3-compatible) |
| Web | Next.js (App Router), React, Tailwind |
| Mobile | React Native, Expo, Expo Router |
| Testes | Vitest |

## Estrutura

```
apps/api          API HTTP (monólito modular)
apps/web          Aplicação web
apps/mobile       Aplicativo mobile
packages/*        Domínio, contratos, UI, tokens, database, etc.
infrastructure/   Docker e scripts locais
docs/             Arquitetura, ADRs, diagramas e glossário
```

## Pré-requisitos

- Node.js 20+
- pnpm 9.15+
- Docker e Docker Compose

## Instalação

```bash
cp .env.example .env
pnpm install
```

## Configuração

Edite `.env` conforme necessário. Variáveis obrigatórias são validadas com Zod na inicialização da API.

## Infraestrutura local

```bash
pnpm infra:up          # PostgreSQL + MinIO
pnpm db:generate       # Prisma Client
pnpm db:migrate        # Migrações
pnpm db:seed           # Seeds de desenvolvimento (credenciais demo)
```

- PostgreSQL: `localhost:5433` (porta host configurável via `POSTGRES_PORT`; padrão do compose é 5432 se livre)
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001` (`minioadmin` / `minioadmin`)
- Bucket inicial: `pp-planning` (privado)

> Neste ambiente de desenvolvimento, a porta 5432 já estava em uso; o `.env.example` usa `5433`.

## Executar aplicações

```bash
pnpm dev:api           # http://localhost:3333  (docs: /docs)
pnpm dev:web           # http://localhost:3000
pnpm dev:mobile        # Expo Dev Tools
```

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Convenções principais

- Moeda: **centavos (`bigint`)**, sem ponto flutuante.
- Idioma/UI: **pt-BR**; fuso: **America/Sao_Paulo**.
- Datas na API: **ISO 8601**; na UI: formato brasileiro.
- Todo dado financeiro pertence a um **workspace**.
- Categorias/subcategorias são **inativáveis** (sem exclusão física histórica).
- Frontends consomem **somente a API** (nunca Prisma).
- Separação clara: **Planning** (planejado) ≠ **Ledger** (realizado).

## Etapa 2 — Autenticação e workspaces compartilhados

Esta etapa adiciona cadastro/login, sessões com JWT, workspaces com membros e convites. Rotas protegidas exigem `Authorization: Bearer <accessToken>` e, quando aplicável, o header `X-Workspace-Id`.

### Credenciais demo (seed)

Após `pnpm db:seed`:

| Conta | E-mail | Senha | Papel no workspace demo |
|-------|--------|-------|-------------------------|
| Demo Owner | `demo.owner@pp-planning.local` | `demo-senha-segura` | `owner` |
| Demo Viewer | `demo.viewer@pp-planning.local` | `demo-senha-segura` | `viewer` |

Workspace criado pelo seed: **Planejamento Familiar Demo** (o ID é exibido no terminal após o seed).

### Criar um workspace compartilhado

1. Faça login ou cadastre-se (`POST /v1/auth/login` ou `POST /v1/auth/register`).
2. Crie um novo workspace com `POST /v1/workspaces` e body `{ "name": "Planejamento Familiar" }`.
3. O usuário autenticado vira `owner` automaticamente.
4. Use o `id` retornado como `X-Workspace-Id` nas rotas `/v1/workspaces/current/*`.

> No cadastro (`POST /v1/auth/register`), um workspace pessoal já é criado (ex.: `Planejamento de Ana`). Para compartilhar com outra pessoa, crie um workspace dedicado ou convide alguém para o workspace existente.

### Convidar uma pessoa

Pré-requisitos: autenticação, `X-Workspace-Id` e permissão `invitations.create` (`owner` ou `admin`).

```http
POST /v1/workspaces/current/invitations
Authorization: Bearer <accessToken>
X-Workspace-Id: <workspaceId>
Content-Type: application/json

{ "email": "conjuge@example.com", "role": "member" }
```

A resposta inclui `invitation` e `invitationLink` (ex.: `http://localhost:3000/convites/<token>`). **Envio de e-mail ainda não está implementado** — copie o link manualmente para testes.

Regras de convite por papel do convidador:

- `owner`: pode convidar com qualquer papel (`owner`, `admin`, `member`, `viewer`).
- `admin`: só pode convidar `member` ou `viewer`.

### Aceitar um convite

1. Obtenha o token a partir de `invitationLink` (último segmento da URL).
2. (Opcional) Consulte o preview público: `GET /v1/invitations/:token`.
3. A pessoa convidada deve ter conta com o **mesmo e-mail** do convite (cadastre-se se necessário).
4. Autentique-se e aceite:

```http
POST /v1/invitations/:token/accept
Authorization: Bearer <accessToken>
```

Resposta: `{ "workspaceId", "membershipId" }`. A partir daí, o workspace aparece em `GET /v1/workspaces`.

Para recusar: `POST /v1/invitations/:token/decline` (também exige autenticação e e-mail correspondente).

### Trocar de workspace (`X-Workspace-Id`)

Um usuário pode pertencer a vários workspaces (`GET /v1/workspaces`). Para operar em um deles:

1. Escolha o `workspace.id` desejado na listagem.
2. Envie `X-Workspace-Id: <uuid>` em **todas** as rotas que usam `/v1/workspaces/current/*` e em rotas de domínio (ex.: `/v1/categories`).

A API valida membership ativo; enviar um ID sem vínculo retorna `403 WORKSPACE_ACCESS_DENIED`. Omitir o header retorna `400 WORKSPACE_REQUIRED`.

### Promover um membro

Owners podem promover qualquer membro, inclusive a `owner` (múltiplos owners são permitidos). Admins **não** podem alterar papéis de ou para `owner`.

```http
PATCH /v1/workspaces/current/members/:memberId/role
Authorization: Bearer <accessToken>
X-Workspace-Id: <workspaceId>
Content-Type: application/json

{ "role": "owner" }
```

Liste membros com `GET /v1/workspaces/current/members` para obter `memberId`. O workspace deve manter **pelo menos um owner ativo** — o último owner não pode sair nem ser rebaixado/removido.

Outras ações de membership:

- Remover membro: `DELETE /v1/workspaces/current/members/:memberId`
- Sair do workspace: `POST /v1/workspaces/current/leave`

### Testar via Swagger

1. Suba a API: `pnpm dev:api`
2. Abra [http://localhost:3333/docs](http://localhost:3333/docs)
3. **Auth**: use `POST /v1/auth/login` (ou register) e copie `accessToken` e `refreshToken`.
4. Clique em **Authorize** e informe `Bearer <accessToken>`.
5. Para rotas de workspace/categorias, adicione o header **`X-Workspace-Id`** (campo disponível nas rotas protegidas ou via "Try it out" nos headers).
6. Fluxo sugerido: login → listar workspaces → copiar `id` → criar convite → login como convidado → aceitar convite → listar categorias no workspace compartilhado.

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Diagramas](./docs/diagrams/)
- [ADRs](./docs/adr/)
- [Glossário](./docs/product/domain-glossary.md)
- [Modelo de dados](./docs/architecture/data-model.md)
- [Design system](./docs/architecture/design-system.md)
- [Segurança](./docs/architecture/security.md)
- [Eventos internos](./docs/architecture/internal-events.md)
