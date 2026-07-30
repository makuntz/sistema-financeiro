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
pnpm db:seed           # Seeds (vazio nesta etapa)
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

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Diagramas](./docs/diagrams/)
- [ADRs](./docs/adr/)
- [Glossário](./docs/product/domain-glossary.md)
- [Modelo de dados](./docs/architecture/data-model.md)
- [Design system](./docs/architecture/design-system.md)
- [Segurança](./docs/architecture/security.md)
- [Eventos internos](./docs/architecture/internal-events.md)
