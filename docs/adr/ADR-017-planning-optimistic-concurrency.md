# ADR-017: Planning Optimistic Concurrency

## Status

Accepted

## Context

A workspace can be shared (e.g. a couple editing the same monthly plan). Last-write-wins would silently overwrite the other person's changes. Automatic merge of monetary line items is non-trivial and error-prone for this stage.

## Decision

- `MonthlyPlan.version` is an optimistic concurrency token.
- Save and copy-previous accept `expectedVersion` (`null` when the plan does not exist yet).
- Update succeeds only when the current DB version equals `expectedVersion`; then version increments atomically.
- On mismatch, API returns `409` with code `PLAN_VERSION_CONFLICT` and a clear Portuguese message.
- UI keeps local draft values, shows the conflict, and offers **Recarregar planejamento** — no automatic merge.

Copy-previous additionally:

- Returns `PLAN_ALREADY_HAS_VALUES` when the destination has values and `overwrite` is false
- With `overwrite: true`, still validates `expectedVersion`

## Consequences

- **Positive**: Concurrent editors cannot silently overwrite each other
- **Positive**: Simple, auditable conflict model
- **Negative**: User must reload and re-apply changes after a conflict
- **Negative**: Automatic merge deferred to a future stage
