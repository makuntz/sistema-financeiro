# Eventos internos

## Abstração atual

Interface `EventBus` em `@pp-planning/domain` com implementação `InMemoryEventBus`.

Eventos de exemplo:

- `CategoryCreated`
- `TransactionCreated` (futuro)
- `MonthlyPlanUpdated` (futuro)
- `ReceiptUploaded` / `ReceiptProcessed` (futuro)
- `BudgetLimitReached` (futuro)

## O que não fazer agora

- Kafka / RabbitMQ
- Event sourcing
- Infra distribuída

## Evolução futura

1. Manter contratos de eventos no domínio
2. Adicionar outbox na mesma transação do Prisma
3. Publicar para broker apenas na borda de infraestrutura
4. Extrair consumidores (OCR, notifications) quando houver necessidade real
