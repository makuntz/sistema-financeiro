# ADR-021: Receipt Item Allocation

## Status

Accepted

## Context

A supermarket receipt often mixes items that belong to different budget subcategories (e.g. groceries, beer, cleaning products, pharmacy). The mobile UX offers a **default category** (`defaultCategoryId` on `ReceiptCapture`) to prioritize subcategory suggestions, but must not restrict classification. The Ledger already models realized expenses as `LedgerEntry` rows; creating one entry per line item would clutter history (40 items → 40 entries).

## Decision

- **`defaultCategoryId` is a suggestion only** — it influences UI ordering (subcategories of that category first) but does not constrain item classification.
- **`selectedSubcategoryId` on `ReceiptItem` is the source of truth** for allocation. Category is always derived from the subcategory at confirmation time (`Subcategory.categoryId`).
- **Do not persist `categoryId` on `ReceiptItem`** — avoids conflicting category/subcategory pairs; DTOs may expose derived category names for display only.
- **One subcategory per item** — no split of a single line across multiple subcategories in this stage.
- **Batch classification** via `BulkAssignReceiptItems` (`POST .../items/bulk-assign`) and **batch ignore** via `BulkIgnoreReceiptItems`.
- **Group non-ignored items by `selectedSubcategoryId`** (`groupItemsBySubcategory`); create **one `LedgerEntry` per group**, not per item.
- Group amount = sum of `lineTotalInCents` for items in the group. Description pattern: `Compra no {merchant} · {subcategoryName}` or `Compra registrada por nota · {subcategoryName}` when merchant is unknown.
- **Total reconciliation**: sum of non-ignored item totals must match `totalAmountInCents` within **2 centavos** (`RECEIPT_TOTAL_TOLERANCE_CENTS = 2`); otherwise confirmation fails with `RECEIPT_TOTAL_MISMATCH`.
- Extend **LedgerEntry** with `origin` (`manual` | `receipt`, default `manual`) and optional **`receiptCaptureId`** linking generated entries back to the capture (composite FK with `workspaceId`).
- Confirmation is **atomic** (single transaction): create all ledger entries, update items, mark capture `confirmed` — all or nothing.
- Only **expense** subcategories are allowed for receipt items at confirmation.

## Alternatives considered

1. **One LedgerEntry per ReceiptItem** — rejected; unusable history for long receipts; contradicts product goal of reducing registration time.
2. **`categoryId` stored on each item** — rejected; duplicates subcategory’s category and allows inconsistent pairs.
3. **Single LedgerEntry for entire receipt** — rejected; loses subcategory breakdown needed for Planning comparison.
4. **Join table `ReceiptLedgerEntry`** — rejected; optional `receiptCaptureId` on `LedgerEntry` is simpler and sufficient for traceability.
5. **Auto-distribute total mismatch across items** — rejected; silent corrections hide user-visible errors.

## Consequences

- **Positive**: Ledger stays readable; Planning comparison works per subcategory; traceability from entry → capture → items.
- **Positive**: Mixed-category receipts are first-class; default category speeds common case without locking users in.
- **Negative**: Users must classify every non-ignored item before confirm; unclassified items block progress by design.
- **Negative**: Total mismatch requires manual fix (edit items/total or ignore lines) — no automatic discount line in MVP.
