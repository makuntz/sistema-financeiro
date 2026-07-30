# ADR-016: Monthly Planning Model

## Status

Accepted

## Context

PP Planning needs a monthly budget intent before recording real transactions (Ledger). Users must define how much they intend to earn and spend per subcategory for a given month, with category and workspace totals computed by the system.

Alternatives considered:

1. **Separate IncomeSource entity** — rejected for this stage; income is already modeled as `Category.type = income` with subcategories acting as income sources.
2. **Editable planned amount on Category** — rejected; creates inconsistency with subcategory sums.
3. **DateTime month key** — rejected due to timezone ambiguity; use `year` + `month` integers instead.
4. **Dense storage of zero items** — rejected; sparse storage keeps the table smaller while the read model still returns all active subcategories as zero.

## Decision

- One `MonthlyPlan` per `(workspaceId, year, month)`.
- Planned values live only on `MonthlyPlanItem` keyed by `(monthlyPlanId, subcategoryId)`.
- `plannedAmountInCents` is `BigInt` ≥ 0 in domain/DB; HTTP uses digit strings (`MoneyInCents`).
- Sparse persistence: amounts > 0 are stored; zero removes the item; missing item means zero on read.
- Category totals, income/expense totals, and projected balance are **projections** computed server-side — never accepted from the client.
- Plans are created on first save, not on page open.
- `version` starts at 1 and increments on every successful save.
- Historical inactive taxonomy with persisted amounts remains visible (read-only) for that month.
- Copy-previous copies only currently active taxonomy.

## Consequences

- **Positive**: Single taxonomy for income and expense; no duplicate income-source concept
- **Positive**: Impossible for category total to disagree with subcategory sum
- **Positive**: Clear Planning vs Ledger separation (Ledger not implemented yet)
- **Negative**: Categories without subcategories cannot be planned directly (by design)
- **Negative**: Future IncomeSource-specific rules would require a new entity (allowed later)
