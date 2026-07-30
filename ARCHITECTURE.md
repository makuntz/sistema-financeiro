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

## Estratégia multi-workspace

Todo registro financeiro carrega `workspaceId`. Acesso sempre filtrado pelo vínculo do usuário autenticado. O frontend não deve ser a fonte da verdade do workspace autorizado.

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
