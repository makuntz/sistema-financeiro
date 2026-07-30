# Módulos internos da API

```mermaid
flowchart TB
  HTTP[Presentation HTTP /v1]

  subgraph modules [Módulos]
    Identity
    Workspaces
    Taxonomy
    Planning
    Ledger
    Accounts
    Cards
    Installments
    Recurring
    Documents
    ReceiptProcessing[Receipt Processing]
    Reports
    Goals
    Notifications
    Audit
  end

  DomainShared[domain shared: Money, EventBus, DomainError]
  DB[(PostgreSQL via Prisma)]
  Bus[InMemory EventBus]

  HTTP --> Taxonomy
  HTTP --> Identity
  HTTP --> Workspaces
  HTTP --> Planning
  HTTP --> Ledger

  Taxonomy --> DomainShared
  Planning --> DomainShared
  Ledger --> DomainShared

  Taxonomy --> DB
  Planning --> DB
  Ledger --> DB
  Accounts --> DB
  Audit --> DB

  Taxonomy --> Bus
  Ledger --> Bus
  ReceiptProcessing --> Bus
```

## Módulo de exemplo implementado

**Taxonomy** (parcial): entidade `Category`, VO `CategoryName`, `CreateCategory`, repositório Prisma + in-memory, rotas `POST/GET /v1/categories`.
