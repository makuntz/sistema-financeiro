# ADR-020: Receipt Capture and Processing

## Status

Accepted

## Context

Etapa 6 introduces mobile receipt capture: the user photographs a purchase receipt, the system extracts structured data, the user reviews and classifies items, and confirmed groups become Ledger entries. Receipt images may contain sensitive data (CPF fragments, purchase habits). Processing is slow and unreliable compared to a typical HTTP request. The product must never write to the Ledger without explicit human confirmation.

The monorepo already uses PostgreSQL, MinIO (S3-compatible) for local files, and an in-memory `EventBus` — not Kafka/RabbitMQ/SQS. A real OCR/AI provider is intentionally deferred until a future benchmark (see ADR-022 and `docs/architecture/receipt-extractor-evaluation.md`).

## Decision

- Introduce **ReceiptCapture** as the aggregate for a photographed purchase, with status machine: `draft → uploaded → processing → review → confirmed | failed | canceled` (reprocess from `review` or `failed`).
- Store **ReceiptImage** metadata in PostgreSQL; store image bytes in **private S3-compatible storage** (MinIO locally). Persist only `storageKey` — never base64 or blob columns in PostgreSQL.
- Upload via **presigned URLs**: client requests URL from API, PUTs directly to storage, API verifies object existence/metadata before marking upload complete.
- Run extraction **asynchronously** via **ReceiptProcessingJob** rows in PostgreSQL, processed by a dedicated worker (`pnpm --filter @pp-planning/api worker:receipts`).
- Claim jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, worker lock fields (`lockedAt`, `lockedBy`), lock expiry (5 minutes), and **max 3 attempts** (`RECEIPT_PROCESSING_MAX_ATTEMPTS`) with 30s retry delay.
- Use **FakeReceiptExtractor** as the only provider in this stage (`RECEIPT_EXTRACTOR_PROVIDER=fake`).
- **Human confirmation is mandatory**: extraction populates `review`; only `ConfirmReceiptCapture` creates Ledger entries after validation.
- Receipt routes reuse **ledger.read** (view/list) and **ledger.write** (create/upload/process/edit/confirm).

## Alternatives considered

1. **Synchronous extraction in the HTTP handler** — rejected; blocks mobile UX, no retry on transient failures, poor timeout behaviour.
2. **Kafka / RabbitMQ / SQS / Redis queue** — rejected for this stage; adds operational complexity before volume justifies it; PostgreSQL job table is sufficient.
3. **Base64 or bytea in PostgreSQL** — rejected; bloats DB backups, poor fit for large images, complicates CDN/storage policies.
4. **Multipart upload through API** — rejected as primary path; presigned upload offloads bandwidth and keeps API stateless for bytes.
5. **Auto-confirm on successful extraction** — rejected; OCR/IA errors must not silently create financial facts (same principle as ADR-006 Planning vs Ledger).

## Consequences

- **Positive**: Full capture flow works end-to-end without external AI keys; images stay private; jobs survive API restarts; domain stays provider-agnostic.
- **Positive**: Mobile can leave the processing screen; worker continues in background.
- **Negative**: Operators must run API **and** receipt worker in development/production.
- **Negative**: PostgreSQL polling + row locks do not scale to very high throughput; acceptable for current stage.
- **Negative**: Images are retained after confirmation (MVP); future retention/deletion policy must be designed separately — no invented legal deadlines.
