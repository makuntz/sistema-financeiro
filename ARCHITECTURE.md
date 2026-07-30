# Arquitetura — PP Planning

## Por que monorepo

API, web, mobile e pacotes compartilhados evoluem juntos. Contratos, tokens e regras de domínio ficam versionados no mesmo repositório, reduzindo drift entre plataformas.

## Por que monólito modular

No estágio atual, um único deploy de API com módulos bem delimitados oferece velocidade de desenvolvimento e simplicidade operacional. Módulos como Receipt Processing, Notifications e Reports poderão ser extraídos depois sem reescrever o domínio.

## Limites dos módulos

| Módulo | Responsabilidade |
|--------|------------------|
| Identity | Usuários, autenticação, sessões, preferências |
| Workspaces | Espaço compartilhado, membros, papéis, convites |
| Taxonomy | Categorias, subcategorias, fontes de receita |
| Planning | Orçamento mensal planejado |
| Ledger | O que realmente aconteceu (lançamentos) |
| Accounts | Contas, bancos, saldos |
| Cards | Cartões e faturas |
| Installments | Compras parceladas |
| Recurring | Regras recorrentes |
| Documents | Anexos e metadados |
| Receipt Processing | OCR/IA (futuro), com confirmação humana |
| Reports | Agregações e indicadores |
| Goals | Metas |
| Notifications | Alertas (futuro) |
| Audit | Trilha de auditoria |

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

| Status | Condição |
|--------|----------|
| `pending` | Sem `acceptedAt`, `declinedAt`, `revokedAt` e `expiresAt` no futuro |
| `accepted` | `acceptedAt` preenchido |
| `declined` | `declinedAt` preenchido |
| `revoked` | `revokedAt` preenchido |
| `expired` | TTL de 7 dias ultrapassado e ainda pendente |

Fluxo: owner/admin cria convite → token opaco na URL → convidado faz login/cadastro com o e-mail convidado → aceita ou recusa. Novo convite para o mesmo e-mail revoga o pendente anterior. Aceitar exige que o e-mail da conta autenticada coincida com o do convite.

**E-mail**: envio transacional ainda **não implementado**. A API devolve `invitationLink` na criação; integração futura com provedor (ex.: SES, Resend) usará o mesmo link.

## Múltiplos owners

Um workspace pode ter **vários owners** simultâneos (convite ou promoção via `PATCH .../role`). Regra invariante: **sempre pelo menos um owner ativo**. O último owner não pode sair, ser rebaixado ou removido (`LAST_OWNER_REQUIRED`).

Admins gerenciam membros, mas não alteram papéis envolvendo `owner`.

## Propriedade vs autoria dos dados

Três eixos distintos:

| Campo | Significado |
|-------|-------------|
| `workspaceId` | **Proprietário lógico** — a quem pertence o dado financeiro; isolamento e autorização |
| `createdByUserId` | **Autor** — quem criou o registro (workspace, convite, etc.); auditoria |
| `paidByMemberId` *(futuro)* | **Quem pagou** — atribuição pessoal dentro do workspace compartilhado (ex.: “Leandro pagou este gasto”) |

Exemplo: uma `Transaction` tem `workspaceId` (visível a todos os membros com permissão), pode registrar `createdByUserId` (quem lançou) e, no futuro, `paidByMemberId` (quem efetivamente pagou), sem transferir ownership do dado para o usuário.

## Planning vs Ledger

- **Planning**: intenção (orçamento do mês).
- **Ledger**: fato (lançamentos reais).
- Comparativos nascem da combinação dos dois, sem misturar conceitos nas entidades.

## OCR e IA (futuro)

O módulo Receipt Processing extrai dados e sugere lançamentos. **Nunca** grava no Ledger sem confirmação do usuário.

## Arquivos (futuro)

Interface S3-compatible. Localmente: MinIO. Anexos privados com URLs temporárias.

## Eventos internos

`EventBus` in-memory para desenvolvimento/testes. Evolução futura pode usar outbox + broker, sem acoplar o domínio a Kafka/RabbitMQ agora.
