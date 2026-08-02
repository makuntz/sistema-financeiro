# PP Planning

Sistema de planejamento financeiro pessoal e familiar (nome provisório).

Esta etapa entrega a **arquitetura inicial**: monorepo, monólito modular, pacotes compartilhados, API de exemplo (Taxonomy), fundação web/mobile, infraestrutura local e documentação. A **Etapa 3** adiciona a aplicação web com autenticação via BFF (cookies HttpOnly), seleção de planejamento, gestão de categorias/subcategorias e convites. A **Etapa 4** entrega o **Planejamento Mensal** (orçamento por subcategoria). A **Etapa 5** entrega **Lançamentos** (receitas e gastos realizados) e a comparação **planejado versus realizado**. A **Etapa 6** entrega **Captura inteligente de compras** no mobile: escanear nota, processamento assíncrono com extrator fake, revisão, classificação por subcategoria e confirmação em lançamentos agrupados.

## Stack

| Camada           | Tecnologia                             |
| ---------------- | -------------------------------------- |
| Monorepo         | pnpm workspaces + Turborepo            |
| Linguagem        | TypeScript (strict)                    |
| API              | Node.js, Fastify, Zod, OpenAPI, Prisma |
| Banco            | PostgreSQL                             |
| Arquivos (local) | MinIO (S3-compatible)                  |
| Web              | Next.js (App Router), React, Tailwind  |
| Mobile           | React Native, Expo, Expo Router        |
| Testes           | Vitest                                 |

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
pnpm db:seed           # Seeds de desenvolvimento (credenciais demo + categorias exemplo)
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

| Conta       | E-mail                          | Senha               | Papel no workspace demo |
| ----------- | ------------------------------- | ------------------- | ----------------------- |
| Demo Owner  | `demo.owner@pp-planning.local`  | `demo-senha-segura` | `owner`                 |
| Demo Viewer | `demo.viewer@pp-planning.local` | `demo-senha-segura` | `viewer`                |

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

## Etapa 3 — Web com BFF, categorias e convites na interface

A aplicação web consome a API exclusivamente via **Next.js BFF** (`/api/bff/*`). Tokens de sessão ficam em **cookies HttpOnly** — nunca em `localStorage` ou `sessionStorage`.

### Subir API + web

Ordem recomendada para desenvolvimento local:

```bash
pnpm infra:up          # PostgreSQL + MinIO
pnpm db:generate       # Prisma Client
pnpm db:migrate        # Migrações
pnpm db:seed           # Usuários demo + categorias exemplo
pnpm dev:api           # http://localhost:3333  (docs: /docs)
pnpm dev:web           # http://localhost:3000
```

Em terminais separados, rode `pnpm dev:api` e `pnpm dev:web` (ou use `pnpm dev` para subir tudo via Turborepo).

### Login na web

1. Abra [http://localhost:3000/login](http://localhost:3000/login).
2. Use as credenciais demo (após `pnpm db:seed`):

| Conta       | E-mail                          | Senha               |
| ----------- | ------------------------------- | ------------------- |
| Demo Owner  | `demo.owner@pp-planning.local`  | `demo-senha-segura` |
| Demo Viewer | `demo.viewer@pp-planning.local` | `demo-senha-segura` |

O owner pode gerenciar categorias e convites; o viewer tem acesso somente leitura.

> **Autenticação:** o login grava `pp_access_token` e `pp_refresh_token` em cookies HttpOnly via BFF. O JavaScript da página **não** lê nem armazena tokens — apenas chama `fetch('/api/bff/...')` e o servidor repassa credenciais à API.

### Trocar de planejamento (workspace)

Na barra lateral, clique no nome do planejamento atual (seletor no topo). Escolha outro workspace na lista ou use **Criar planejamento** para um novo.

A seleção chama `POST /api/bff/workspaces/select` e grava o cookie `pp_workspace_id` (preferência de contexto). A API continua validando membership a cada requisição — trocar o cookie não concede acesso a um workspace sem vínculo.

### Criar categoria e subcategoria

1. Acesse **Categorias** no menu (`/configuracoes/categorias`).
2. **Nova categoria**: informe nome, tipo (Receita/Despesa), cor e ícone.
3. **Subcategoria**: expanda a categoria (seta) → **Adicionar subcategoria** → informe o nome.

Para arquivar ou reativar uma categoria, use o ícone de arquivo na linha da categoria. Na interface o termo é **Arquivar**; na API/domínio a operação é `inactivate` / `reactivate` (sem exclusão física).

### Convidar uma pessoa (interface web)

1. Acesse **Pessoas e acesso** (`/configuracoes/pessoas`) — requer papel `owner` ou `admin`.
2. Clique em **Convidar**, informe o e-mail e o papel (Administrador, Membro ou Somente leitura).
3. O convite aparece em **Convites pendentes**. Envio de e-mail ainda não está implementado — use a API (`invitationLink` na resposta de `POST /v1/workspaces/current/invitations`) ou o fluxo de convite em `/convites/<token>` para testes.

A pessoa convidada deve cadastrar-se ou entrar com o **mesmo e-mail** do convite e aceitar em `http://localhost:3000/convites/<token>`.

### Planejamento mensal (web)

1. Abra **Planejamento** no menu (`/planejamento`) ou use a URL com período: `/planejamento?ano=2026&mes=7&aba=resumo`.
2. Navegue entre meses com as setas (timezone padrão do workspace: `America/Sao_Paulo`).
3. Abas: **Resumo**, **Receitas** (categorias `income`), **Gastos** (categorias `expense`).
4. **Editar planejamento** transforma valores das subcategorias em inputs `R$`; totais de categoria e cards superiores atualizam localmente. **Salvar alterações** envia só itens de subcategoria — totais são recalculados no backend.
5. **Copiar mês anterior** replica valores ativos; se o destino já tiver valores, a UI pede confirmação (`overwrite=true`).
6. Viewer: somente leitura (sem editar/copiar).
7. Concorrência: se outra pessoa salvou primeiro, a API retorna `PLAN_VERSION_CONFLICT` e a tela oferece **Recarregar planejamento**.
8. Nas abas Receitas/Gastos, a tela mostra **planejado**, **realizado/recebido** e **disponível/diferença** a partir do relatório mensal (somente leitura; editar o planejamento não altera lançamentos).

### Lançamentos (web) — Etapa 5

Na interface use sempre **Lançamentos** (não “Ledger”). Ledger é só o nome técnico do módulo de fatos financeiros.

1. Abra **Lançamentos** (`/lancamentos`) ou `/lancamentos?ano=2026&mes=8`.
2. Cards: receitas realizadas, gastos realizados, saldo realizado (competência do mês).
3. **Novo lançamento**: tipo (Receita/Gasto), descrição, valor, data, competência, categoria, subcategoria, pessoa opcional (“Quem pagou?” / “Quem recebeu?”), observações.
4. Competência padrão = mês/ano da data; após alterar competência manualmente, mudar a data **não** sobrescreve a competência.
5. **Excluir lançamento** é exclusão lógica (void): sai dos totais, permanece auditável e pode ser **restaurado**.
6. Filtros: tipo, busca, incluídos/excluídos; paginação na API.
7. Viewer: somente leitura.
8. Concorrência: `expectedVersion` → `LEDGER_ENTRY_VERSION_CONFLICT` com opção de recarregar.

Comparação com o planejamento:

- Usa **competência**, não a data do pagamento.
- Gastos: diferença = planejado − realizado (disponível; pode ser negativo).
- Receitas: diferença = realizado − planejado (acima/abaixo do previsto).
- Endpoint: `GET /v1/reports/monthly-budget/:year/:month` (BFF: `/api/bff/reports/monthly-budget/...`).

### Testar concorrência (dois usuários)

1. Faça login como owner em um navegador e como outro membro/owner em outro (ou janela anônima).
2. Abra o mesmo mês em ambos, edite valores diferentes e salve no primeiro.
3. Ao salvar no segundo com a versão antiga, deve aparecer o conflito — sem sobrescrita silenciosa.

### Seed — categorias, planos e lançamentos demo

Além dos usuários e do workspace **Planejamento Familiar Demo**, o seed cria categorias, planos do mês atual e do mês anterior, e **lançamentos** demo (salário abaixo do previsto, mantimentos, presentes sem planejado, etc.). O seed é **idempotente**.

| Tipo    | Categoria       | Subcategorias (exemplos)                                            |
| ------- | --------------- | ------------------------------------------------------------------- |
| Despesa | Mantimentos     | Mercado semanal, Feira, Padaria, Açougue                            |
| Despesa | Saúde           | Plano de saúde, Farmácia, Consultas, Exames                         |
| Despesa | Transporte      | Combustível, Estacionamento, Transporte público, Manutenção veículo |
| Despesa | Moradia         | Aluguel, Condomínio, Energia, Água, Internet                        |
| Despesa | Presentes       | Presentes diversos (planejado zero no demo)                         |
| Receita | Salários        | Salário principal, Segunda renda                                    |
| Receita | Benefícios      | Vale-alimentação, Reembolsos                                        |
| Receita | Outras receitas | Rendimentos, Receitas extras                                        |

Credenciais demo: `demo.owner@pp-planning.local` / `demo.viewer@pp-planning.local` — senha `demo-senha-segura`.

## Etapa 6 — Captura de notas (mobile)

App Expo para escanear notas, classificar itens e confirmar lançamentos de gasto. **Sem OCR/IA real nesta etapa** — apenas `FakeReceiptExtractor`.

### Configuração mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

| Ambiente                 | `EXPO_PUBLIC_API_URL`    |
| ------------------------ | ------------------------ |
| Android Emulator         | `http://10.0.2.2:3333`   |
| Dispositivo físico (LAN) | `http://<IP_DO_PC>:3333` |
| iOS Simulator (futuro)   | `http://127.0.0.1:3333`  |

A URL é obrigatória — não há fallback silencioso. No `.env` da API, use `HOST=0.0.0.0` para aceitar conexões do emulador/dispositivo.

### Infraestrutura e variáveis de receipt

Após `pnpm infra:up`, o bucket **`pp-planning`** (privado) fica disponível no MinIO. No `.env` da raiz:

```env
RECEIPT_EXTRACTOR_PROVIDER=fake
RECEIPT_PROCESSING_MAX_ATTEMPTS=3
RECEIPT_IMAGE_MAX_SIZE_BYTES=10485760
RECEIPT_IMAGE_MAX_COUNT=3
RECEIPT_ALLOW_FAKE_IN_PRODUCTION=false
```

Em produção, `RECEIPT_EXTRACTOR_PROVIDER=fake` exige `RECEIPT_ALLOW_FAKE_IN_PRODUCTION=true` explícito.

### Executar API + worker + mobile

Em terminais separados (na raiz do monorepo):

```bash
pnpm infra:up
pnpm db:migrate
pnpm dev:api                              # terminal 1 — http://localhost:3333
pnpm --filter @pp-planning/api worker:receipts   # terminal 2 — processa jobs
pnpm --filter @pp-planning/mobile android        # terminal 3 — app Android
```

O **worker de receipts** é obrigatório para concluir o processamento após `POST .../process`.

### Fluxo Android (smoke test)

1. **Login** com credenciais demo (owner).
2. Aba **Lançar** → **Escanear nota** (câmera ou galeria).
3. Aguardar **Processando** (polling até status `review` ou `failed`).
4. **Conferir** — editar estabelecimento, data, total se necessário.
5. **Classificar itens** — individual ou em lote; categoria principal é só sugestão.
6. **Resumo** — grupos por subcategoria; conferir total (tolerância 2 centavos).
7. **Confirmar** — cria um `LedgerEntry` por subcategoria (não um por item).

Alternativa: **Novo gasto manual** / **Nova receita** na mesma aba.

### Cenários fake (desenvolvimento)

Ao criar captura via API (`POST /v1/receipt-captures`), body opcional `fakeScenario`:

| Valor                | Efeito                                     |
| -------------------- | ------------------------------------------ |
| `success`            | Extração padrão (4 itens, total R$ 132,20) |
| `missing-item-value` | Item sem valor → `needsReview`             |
| `total-mismatch`     | Total diverge da soma dos itens            |
| `processing-failure` | Job falha após retries                     |
| `long-receipt`       | 12 itens                                   |

Não expor seletor de cenário na UI de produção. Útil via Swagger ou testes.

### Limitações atuais (Etapa 6)

- Sem fornecedor real de OCR/IA; sem SDKs externos instalados.
- Sem operação offline ou fila de mutations local.
- Sem planejamento completo, convites, relatórios avançados ou gestão de membros no mobile.
- Sem divisão de um item entre duas subcategorias.
- Sem sugestão automática de subcategoria por IA (apenas recentes locais na UI).
- Imagens **não são excluídas** automaticamente após confirmação (MVP).
- Web não implementa captura de notas nesta etapa.

### Limpar sessão mobile

- **Logout** na aba **Mais** → remove refresh token do SecureStore e access token da memória.
- Ou reinstalar o app / limpar dados do app no emulador.
- Chave SecureStore: `pp_planning_refresh_token`.

### Permissões

- **Owner / admin / member**: captura completa (`ledger.write`).
- **Viewer**: somente leitura de capturas (`ledger.read`); não cria, processa nem confirma.

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Diagramas](./docs/diagrams/)
- [ADRs](./docs/adr/)
- [ADR-016 Planejamento mensal](./docs/adr/ADR-016-monthly-planning-model.md)
- [ADR-017 Concorrência otimista](./docs/adr/ADR-017-planning-optimistic-concurrency.md)
- [ADR-018 Ledger Entry](./docs/adr/ADR-018-ledger-entry-model.md)
- [ADR-019 Planejado versus realizado](./docs/adr/ADR-019-planned-versus-realized-read-model.md)
- [ADR-020 Captura e processamento de notas](./docs/adr/ADR-020-receipt-capture-and-processing.md)
- [ADR-021 Alocação de itens da nota](./docs/adr/ADR-021-receipt-item-allocation.md)
- [ADR-022 Abstração do extrator](./docs/adr/ADR-022-receipt-extractor-provider-abstraction.md)
- [Avaliação de extrator (futuro)](./docs/architecture/receipt-extractor-evaluation.md)
- [Glossário](./docs/product/domain-glossary.md)
- [Modelo de dados](./docs/architecture/data-model.md)
- [Design system](./docs/architecture/design-system.md)
- [Segurança](./docs/architecture/security.md)
- [Eventos internos](./docs/architecture/internal-events.md)
