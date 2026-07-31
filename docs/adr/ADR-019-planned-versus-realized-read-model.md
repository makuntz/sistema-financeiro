# ADR-019: Planned Versus Realized Read Model

## Status

Accepted

## Context

Users need “planejado versus realizado” by month, category, and subcategory. Putting Ledger rules inside Planning (or vice versa) would couple write models and invite accidental mutation of plans when registering launches, or creating launches when saving plans.

## Decision

- Keep Planning and Ledger as separate write modules.
- Introduce a minimal **Reports** read module with `GetMonthlyBudgetComparison`.
- Reports depends only on read ports: planned amounts, realized aggregates (non-voided, by competence), and taxonomy for labels / unplanned realized lines.
- Endpoint: `GET /v1/reports/monthly-budget/:year/:month` (permission `reports.read`).
- Difference semantics:
  - **Expense**: `difference = planned - realized` (available budget; may be negative).
  - **Income**: `difference = realized - planned` (above/below forecast).
- Subcategories with planned zero and realized &gt; 0 still appear.
- Archived taxonomy with historical realized still appears (badge in UI).
- Voided ledger entries are excluded from realized.
- Totals and differences are computed on the backend; the web does not invent the source of truth.

## Alternatives considered

1. **Embed realized columns on MonthlyPlanItem** — rejected; couples writes and duplicates aggregates.
2. **Compute only in the frontend** — rejected; inconsistent totals and permission bypass risk.
3. **Materialized table updated by triggers** — deferred; overkill for MVP volume.

## Consequences

- **Positive**: Clear module boundaries; safe independent evolution of Planning and Ledger.
- **Positive**: One place documents income vs expense difference semantics.
- **Negative**: Extra read join/aggregation per request (acceptable for MVP).
- **Negative**: Richer report dimensions (member, account) wait for later stages.
