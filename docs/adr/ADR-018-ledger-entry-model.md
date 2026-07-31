# ADR-018: Ledger Entry Model

## Status

Accepted

## Context

After Monthly Planning (intent), the product needs a place for financial facts: salaries received, supermarket purchases, bills paid. Mixing these facts into `MonthlyPlan` would blur intention vs reality and make edits, voids, and historical taxonomy harder. The UI must call this surface **Lançamentos** (receitas/gastos), while the technical module remains Ledger.

## Decision

- Introduce `LedgerEntry` as the unit of realized money movement.
- Store `amountInCents` as a positive `bigint`; direction comes from `kind` (`income` | `expense`), derived from `Category.type` at create time and stored as a historical snapshot.
- Persist `occurredOn` as PostgreSQL `DATE` (DateOnly `YYYY-MM-DD`), never as a timestamp that can shift by timezone.
- Persist separate `competenceYear` / `competenceMonth` (defaulted from `occurredOn`, overridable) for Planning comparison.
- Optional `attributedMemberId` (who paid/received) is distinct from `createdByUserId` / `updatedByUserId` (who registered/edited).
- Soft void via `voidedAt` / `voidedByUserId` / `voidReason`; restore is supported; voided rows stay out of totals.
- Optimistic concurrency via `version` + `expectedVersion` → `409 LEDGER_ENTRY_VERSION_CONFLICT`.
- No `accountId`, cards, transfers, or imports in this stage.

## Alternatives considered

1. **Store signed amounts** — rejected; sign would duplicate `kind` and invite float-like bugs.
2. **Use occurredOn for budget month** — rejected; bills paid in August for July need competence.
3. **Physical delete** — rejected; audit and restore require soft void (see ADR-008).
4. **Accounts first** — deferred; users can register facts before modeling bank accounts.

## Consequences

- **Positive**: Planning and Ledger stay independent; comparison is a read projection.
- **Positive**: Historical taxonomy and inactive members remain referencable.
- **Negative**: Users must understand competence vs payment date.
- **Negative**: Bank balances and reconciliation wait for Accounts.
