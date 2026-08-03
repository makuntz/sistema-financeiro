# Arquitetura — PP Planning

## Por que monorepo

API, web, mobile e pacotes compartilhados evoluem juntos. Contratos, tokens e regras de domínio ficam versionados no mesmo repositório, reduzindo drift entre plataformas.

## Por que monólito modular

No estágio atual, um único deploy de API com módulos bem delimitados oferece velocidade de desenvolvimento e simplicidade operacional. Módulos como Receipt Processing, Notifications e Reports poderão ser extraídos depois sem reescrever o domínio.

## Limites dos módulos

| Módulo             | Responsabilidade                                               |
| ------------------ | -------------------------------------------------------------- |
| Identity           | Usuários, autenticação, sessões, preferências                  |
| Workspaces         | Espaço compartilhado, membros, papéis, convites                |
| Taxonomy           | Categorias, subcategorias, fontes de receita                   |
| Planning           | Orçamento mensal planejado                                     |
| Ledger             | O que realmente aconteceu (lançamentos)                        |
| Accounts           | Contas, bancos, saldos                                         |
| Cards              | Cartões e faturas                                              |
| Installments       | Compras parceladas                                             |
| Recurring          | Regras recorrentes                                             |
| Documents          | Anexos e metadados                                             |
| Receipt Processing | Captura de notas, extração (fake), confirmação humana → Ledger |
| Reports            | Agregações e indicadores                                       |
| Goals              | Metas                                                          |
| Notifications      | Alertas (futuro)                                               |
| Audit              | Trilha de auditoria                                            |

## Fluxo de dependências

```
web / mobile → api-client → contracts
                ↓
               api → domain ← contracts
                ↓
            database (Prisma) → PostgreSQL
```

- Domínio não depende de Fastify/Prisma/React/Expo.
- Web/mobile nunca acessam Prisma.
- Dependências apontam para dentro (interfaces → domínio).

## Estratégia para dinheiro

Valores em **centavos (`bigint`)**.

Exemplo: `R$ 191,27 = 19127`.

Vantagens: precisão, comparações exatas, alinhamento com sistemas financeiros.

Limitações: conversão na apresentação; cuidado com serialização JSON (`bigint` → string/number controlado).

## Usuário individual vs workspace compartilhado

Cada **usuário** (`User`) tem login próprio (e-mail + senha). Não existe “conta conjunta” — o compartilhamento acontece via **workspace**.

- **Cadastro** (`RegisterUser`): cria usuário, um workspace pessoal (`Planejamento de <Nome>`) e membership `owner`.
- **Workspace compartilhado**: qualquer owner pode criar outro workspace (`POST /v1/workspaces`) ou convidar membros para um workspace existente.
- **Dados financeiros** pertencem ao workspace, não ao usuário isoladamente. Dois cônjuges com logins distintos veem os mesmos dados quando compartilham membership no mesmo workspace.

## Estratégia multi-workspace

Todo registro financeiro carrega `workspaceId`. Um usuário pode ter **vários memberships** ativos (workspace pessoal + familiar + outros). A API lista vínculos em `GET /v1/workspaces`; o cliente escolhe qual contexto usar por requisição.

Resolução do workspace na API (etapa 2.1):

1. Autenticar JWT (`Authorization: Bearer`).
2. Ler `X-Workspace-Id` do header (obrigatório em rotas `/current/*` e domínio).
3. Verificar membership ativo (`WorkspaceMember`) do usuário naquele workspace.
4. Carregar papel e permissões derivadas do role.

O frontend informa qual workspace deseja usar, mas **não é fonte da verdade** — a API valida o vínculo a cada requisição.

## Convites — ciclo de vida

Status derivado de timestamps (não há coluna `status` persistida):

| Status     | Condição                                                            |
| ---------- | ------------------------------------------------------------------- |
| `pending`  | Sem `acceptedAt`, `declinedAt`, `revokedAt` e `expiresAt` no futuro |
| `accepted` | `acceptedAt` preenchido                                             |
| `declined` | `declinedAt` preenchido                                             |
| `revoked`  | `revokedAt` preenchido                                              |
| `expired`  | TTL de 7 dias ultrapassado e ainda pendente                         |

Fluxo: owner/admin cria convite → token opaco na URL → convidado faz login/cadastro com o e-mail convidado → aceita ou recusa. Novo convite para o mesmo e-mail revoga o pendente anterior. Aceitar exige que o e-mail da conta autenticada coincida com o do convite.

**E-mail**: envio transacional ainda **não implementado**. A API devolve `invitationLink` na criação; integração futura com provedor (ex.: SES, Resend) usará o mesmo link.

## Múltiplos owners

Um workspace pode ter **vários owners** simultâneos (convite ou promoção via `PATCH .../role`). Regra invariante: **sempre pelo menos um owner ativo**. O último owner não pode sair, ser rebaixado ou removido (`LAST_OWNER_REQUIRED`).

Admins gerenciam membros, mas não alteram papéis envolvendo `owner`.

## Propriedade vs autoria dos dados

Três eixos distintos:

| Campo                | Significado                                                                             |
| -------------------- | --------------------------------------------------------------------------------------- |
| `workspaceId`        | **Proprietário lógico** — a quem pertence o dado financeiro; isolamento e autorização   |
| `createdByUserId`    | **Autor** — quem criou o registro (workspace, convite, lançamento, etc.); auditoria     |
| `attributedMemberId` | **Quem pagou/recebeu** — membership opcional no lançamento (distinto de quem registrou) |

Exemplo: uma `Transaction` tem `workspaceId` (visível a todos os membros com permissão), pode registrar `createdByUserId` (quem lançou) e, no futuro, `paidByMemberId` (quem efetivamente pagou), sem transferir ownership do dado para o usuário.

## Planning vs Ledger

- **Planning**: intenção (orçamento do mês) — `MonthlyPlan` / `MonthlyPlanItem`.
- **Ledger**: fato (lançamentos reais) — `LedgerEntry` (UI: **Lançamentos**).
- Comparativos ficam no módulo **Reports** (`GetMonthlyBudgetComparison`), somente leitura.
- Competência (`competenceYear`/`competenceMonth`) define o mês do comparativo; `occurredOn` é a data do fato (DATE).
- Exclusão de lançamento é lógica (`voidedAt`); voided não entram em totais/realizado.
- Concorrência otimista em `LedgerEntry.version` (mesmo espírito do Planning).

Ver [ADR-018](./docs/adr/ADR-018-ledger-entry-model.md) e [ADR-019](./docs/adr/ADR-019-planned-versus-realized-read-model.md).

## Captura de notas — Receipt Processing (Etapa 6)

Fluxo mobile-first: fotografar nota → upload privado → processamento assíncrono → revisão → classificação por subcategoria → confirmação → um ou mais `LedgerEntry` agrupados. **Nunca** grava no Ledger sem confirmação humana.

ADRs: [ADR-020](./docs/adr/ADR-020-receipt-capture-and-processing.md), [ADR-021](./docs/adr/ADR-021-receipt-item-allocation.md), [ADR-022](./docs/adr/ADR-022-receipt-extractor-provider-abstraction.md). Avaliação futura de fornecedor: [receipt-extractor-evaluation.md](./docs/architecture/receipt-extractor-evaluation.md).

### Entidades

| Entidade               | Papel                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ReceiptCapture`       | Agregado da compra fotografada; status, merchant, data, total, `defaultCategoryId` (sugestão), metadados de extração |
| `ReceiptImage`         | Metadados da imagem (`storageKey`, MIME, tamanho, posição); bytes no storage externo                                 |
| `ReceiptItem`          | Linha extraída/revisada; `selectedSubcategoryId` é fonte da verdade; sem `categoryId` persistido                     |
| `ReceiptProcessingJob` | Fila persistida no PostgreSQL; lock, tentativas, retry                                                               |

`LedgerEntry` ganhou `origin` (`manual` \| `receipt`) e `receiptCaptureId` opcional para rastrear lançamentos gerados pela captura.

### Extração (FakeReceiptExtractor)

- Porta de domínio: `ReceiptExtractor.extract(ReceiptExtractionInput) → ReceiptExtractionResult`.
- Implementação atual: **`FakeReceiptExtractor`** (`RECEIPT_EXTRACTOR_PROVIDER=fake`); cenários de dev: `success`, `missing-item-value`, `total-mismatch`, `processing-failure`, `long-receipt`.
- Saída validada com Zod antes de persistir itens. Nenhum SDK de OCR/IA real nesta etapa.

### Storage e upload

- Abstração `FileStorage`: `createUploadUrl`, `createDownloadUrl`, `exists`, `getObjectMetadata`, `delete`.
- Local: **MinIO** (`S3_*` no `.env`); bucket privado `pp-planning`.
- Chave gerada pela API: `workspaces/{workspaceId}/receipts/{captureId}/{imageId}.jpg` — cliente não escolhe prefixo livre.
- Fluxo: criar captura → solicitar URL pré-assinada → PUT direto no storage → `complete` (API verifica objeto) → `process`.
- Download para revisão: URL temporária (~15 min); **`storageKey` não é exposto** ao cliente.
- Limites: `RECEIPT_IMAGE_MAX_SIZE_BYTES` (padrão 10 MB), `RECEIPT_IMAGE_MAX_COUNT` (padrão 3), JPEG/PNG.

### Worker e jobs

- Processo separado: `pnpm --filter @pp-planning/api worker:receipts` (polling a cada ~2 s).
- Claim: `SELECT … FOR UPDATE SKIP LOCKED` em jobs `pending` / `retryScheduled`.
- Lock: `lockedAt` / `lockedBy`; expira após 5 min.
- Retry: até **`RECEIPT_PROCESSING_MAX_ATTEMPTS`** (padrão **3**), intervalo 30 s; status `retryScheduled` → nova tentativa.
- Falha definitiva marca captura `failed` com `failureCode` / `failureMessage` seguros.

### Máquina de estados (`ReceiptCapture`)

```
draft → uploaded → processing → review → confirmed
                      ↓            ↑
                    failed    (reprocess)
                      ↓
                  canceled
```

Transições inválidas → `RECEIPT_CAPTURE_INVALID_STATUS`. Captura `confirmed` é terminal nesta etapa.

### Agrupamento → Ledger

- Itens não ignorados agrupados por `selectedSubcategoryId`.
- **Um `LedgerEntry` por grupo** (não por item); soma dos `lineTotalInCents`.
- Reconciliação: total da nota vs. soma dos itens; tolerância **`RECEIPT_TOTAL_TOLERANCE_CENTS = 2`** centavos.
- Confirmação atômica: criar lançamentos + marcar captura confirmada numa transação.

### Permissões

| Permissão      | Capturas                                                 |
| -------------- | -------------------------------------------------------- |
| `ledger.read`  | Listar e visualizar capturas (incl. viewer)              |
| `ledger.write` | Criar, upload, processar, editar, classificar, confirmar |

Rotas exigem `Authorization` + `X-Workspace-Id` + membership ativo.

### Autenticação mobile

Mobile consome **API Fastify diretamente** (sem BFF). Access token em memória; refresh token no **Expo SecureStore**; refresh único em 401. `EXPO_PUBLIC_API_URL` obrigatória. API escuta em `HOST` (padrão `0.0.0.0`) para emulador/dispositivo na LAN.

### Segurança, privacidade e retenção

- Bucket privado; sem URL pública permanente; sem base64 no PostgreSQL.
- Pré-processamento mobile: redimensiona (máx. 2400 px), JPEG, compressão — reduz EXIF/dados sensíveis.
- Logs/auditoria: **não** registram imagem, OCR completo, `storageKey`, URL pré-assinada ou lista integral de produtos.
- **Retenção MVP**: imagens e capturas **permanecem após confirmação**; sem auto-delete; preparar exclusão futura sem inventar prazos legais.

### Escolha futura do provider

Critérios e benchmark (30–50 notas, KPI = tempo médio de correção humana) em [receipt-extractor-evaluation.md](./docs/architecture/receipt-extractor-evaluation.md). Novo provider implementa `ReceiptExtractor` + extensão controlada de `RECEIPT_EXTRACTOR_PROVIDER`.

## Eventos internos

`EventBus` in-memory para desenvolvimento/testes. Evolução futura pode usar outbox + broker, sem acoplar o domínio a Kafka/RabbitMQ agora.

## Autenticação BFF no Next.js (Etapas 3–4)

A web **não** armazena tokens no browser. O BFF (`apps/web/src/app/api/bff/`) atua como proxy autenticado para a API Fastify.

| Cookie             | HttpOnly | Path | Função                                                          |
| ------------------ | -------- | ---- | --------------------------------------------------------------- |
| `pp_access_token`  | Sim      | `/`  | JWT de acesso (~15 min)                                         |
| `pp_refresh_token` | Sim      | `/`  | Refresh opaco (mesma origem; Path não é fronteira de segurança) |
| `pp_workspace_id`  | Não      | `/`  | ID do planejamento selecionado (UI)                             |

Fluxo:

1. Login/registro via `POST /api/bff/auth/login` ou `register` → BFF grava cookies HttpOnly; a resposta JSON **não** expõe tokens.
2. Rotas BFF de domínio usam `authenticatedProxy`: lê o access token do cookie, encaminha `Authorization: Bearer` e `X-Workspace-Id` à API.
3. Em **401**, o BFF tenta **refresh uma única vez** (Map de Promises indexado por SHA-256 do refresh token da requisição atual — sessões distintas não compartilham Promise) e repete a requisição original; falha → limpa cookies e retorna 401.
4. Middleware de borda verifica presença de cookie de sessão nas rotas protegidas; com Path=/, o refresh cookie chega ao middleware; a API permanece a autoridade real.

Detalhes: [ADR-014](./docs/adr/ADR-014-nextjs-bff-authentication.md).

## Planejamento mensal (Etapa 4) e Lançamentos (Etapa 5)

**Planning** = intenção (orçamento do mês). **Ledger** = fatos reais (lançamentos). A UI de planejamento mostra realizado a partir do Reports, sem permitir editar valores realizados.

### Modelo

- `MonthlyPlan`: único por `(workspaceId, year, month)`; `year`/`month` inteiros (não DateTime); `version` para concorrência otimista.
- `MonthlyPlanItem`: valor planejado **somente na subcategoria** (`plannedAmountInCents` BigInt ≥ 0); ausência = zero (armazenamento esparso).
- `LedgerEntry`: lançamento individual com `kind` snapshot, `amountInCents` positivo, `occurredOn` DATE, competência, atribuição opcional a membro, void lógico, `version`.
- Totais de categoria / receitas / gastos / saldo previsto e realizado são **calculados no backend**.
- Receitas usam `Category.type = income`; gastos usam `expense`. Sem entidade `IncomeSource` nesta etapa.
- Taxonomia arquivada com valor histórico permanece visível (somente leitura) naquele mês.

### Dinheiro na API

- Domínio/banco: `bigint` em centavos.
- HTTP: string só com dígitos (`"178609"`). Saldo previsto pode ser negativo (`"-100"`).
- Utilitários: `parseCentsString`, `formatCentsToBRL`, `parseBRLInputToCents` em `@pp-planning/contracts`.

### Endpoints

- `GET /v1/planning/monthly/:year/:month` — `planning.read`
- `PUT /v1/planning/monthly/:year/:month` — `planning.write` (body: `expectedVersion`, `items`; retorna plano completo)
- `POST /v1/planning/monthly/:year/:month/copy-previous` — `planning.write` (`overwrite`, `expectedVersion`)

BFF: `/api/bff/planning/monthly/:year/:month` (+ `/copy-previous`).

Web: `/planejamento?ano=2026&mes=7&aba=resumo|receitas|gastos`.

ADRs: [ADR-016](./docs/adr/ADR-016-monthly-planning-model.md), [ADR-017](./docs/adr/ADR-017-planning-optimistic-concurrency.md).

## Seleção de workspace na web

O cookie `pp_workspace_id` é **apenas preferência de contexto** — legível pelo cliente para exibir o planejamento ativo na sidebar.

- Troca: `POST /api/bff/workspaces/select` valida que o ID está em `GET /v1/workspaces` do usuário antes de gravar o cookie.
- Cada chamada BFF repassa o valor como header `X-Workspace-Id` à API.
- A API **sempre** valida membership ativo; cookie adulterado ou workspace sem vínculo → `403 WORKSPACE_ACCESS_DENIED`.

Isso complementa a estratégia multi-workspace da Etapa 2: o frontend indica o contexto; a API permanece fonte da verdade.

## Grupos de rotas App Router

```
apps/web/src/app/
├── (public)/          # Sem layout autenticado
│   ├── login/
│   ├── cadastro/
│   └── convites/[token]/
├── (app)/             # Layout com sidebar, seletor de workspace, navegação
│   ├── inicio/
│   ├── planejamento/
│   └── configuracoes/
│       ├── categorias/
│       └── pessoas/
├── api/bff/           # Route Handlers — proxy autenticado
└── page.tsx           # Raiz (pública)
```

- **`(public)`**: login, cadastro, preview/aceite de convite. Middleware permite acesso sem cookie de sessão (exceto redirecionamentos pós-login).
- **`(app)`**: área autenticada com shell compartilhado (menu, seletor de planejamento, logout). Middleware exige `pp_access_token` ou `pp_refresh_token`.
- **`/api/bff/*`**: allowlist explícita de rotas; sem proxy genérico aberto. Auth BFF (`/api/bff/auth/*`) e preview de convite são públicos ou semi-públicos conforme rota.

## Categorias e subcategorias — listagem aninhada

Para a tela de gestão, `GET /v1/categories` retorna categorias com **`subcategories` aninhadas** numa única consulta Prisma (`include`), evitando N+1 na primeira renderização.

Mutations permanecem em endpoints dedicados:

- Categoria: `POST/PATCH /v1/categories`, `POST .../inactivate`, `POST .../reactivate`
- Subcategoria: `POST /v1/categories/:id/subcategories`, `PATCH /v1/subcategories/:id`, inactivate/reactivate

O BFF espelha esses paths em `/api/bff/categories` e `/api/bff/subcategories`. A UI expande/colapsa subcategorias localmente; não há endpoint separado de listagem só de subcategorias nesta etapa.

Detalhes de ciclo de vida: [ADR-015](./docs/adr/ADR-015-category-subcategory-lifecycle.md).

## Inativação vs “Arquivar” (terminologia)

| Camada               | Termo                        | Implementação                                             |
| -------------------- | ---------------------------- | --------------------------------------------------------- |
| UI (pt-BR)           | **Arquivar** / **Arquivada** | Botão e badge na lista de categorias                      |
| API / domínio        | `inactivate` / `reactivate`  | `isActive = false` / `true`                               |
| Subcategoria inativa | Badge **Inativa**            | Mesma flag `isActive`; sem rótulo “Arquivada” na UI atual |

Não há exclusão física de Category ou Subcategory. Inativar preserva histórico e unicidade do nome normalizado. Categoria arquivada não aceita novas subcategorias; subcategorias ativas deixam de aparecer em seleções operacionais enquanto a categoria pai estiver inativa.
