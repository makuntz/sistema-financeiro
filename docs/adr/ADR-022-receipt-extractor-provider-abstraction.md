# ADR-022: Receipt Extractor Provider Abstraction

## Status

Accepted

## Context

Receipt capture needs OCR/IA to read Brazilian purchase receipts, but choosing a vendor now would bake in cost, latency, privacy, and accuracy trade-offs without measured data. The product brief requires the full user flow to work **without** integrating OpenAI, Google Document AI, Textract, Mindee, or similar SDKs in Etapa 6. The domain and API must still be ready for a future provider swap after benchmark.

## Decision

- Define port **`ReceiptExtractor`** in domain (`extract(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult>`).
- Validate all extractor output with **`receiptExtractionResultSchema`** (Zod in `@pp-planning/contracts`) before persisting items — untrusted structured data.
- Ship **`FakeReceiptExtractor`** as the only implementation in this stage; deterministic output for tests and local dev.
- Factory **`createReceiptExtractor(provider)`** returns fake when `provider === 'fake'`; any other value throws **`RECEIPT_EXTRACTOR_NOT_CONFIGURED`** at runtime (not silent fallback).
- Env **`RECEIPT_EXTRACTOR_PROVIDER`**: Zod enum accepts **only `'fake'`** today — invalid values fail env validation at startup.
- Production guard: if `NODE_ENV=production` and provider is `fake`, startup fails unless **`RECEIPT_ALLOW_FAKE_IN_PRODUCTION=true`** (explicit opt-in for staging/demos).
- Worker invokes extractor in infrastructure; controllers and React Native never import vendor SDKs.
- **Do not install real provider SDKs** or make HTTP calls to external OCR/IA services in this stage.
- Document evaluation criteria and future benchmark plan in **`docs/architecture/receipt-extractor-evaluation.md`** — **no winner declared** until benchmark runs.
- Future providers implement the same port; selection via env/factory without rewriting use cases.

## Alternatives considered

1. **Pick a default cloud OCR now (e.g. Textract)** — rejected; premature vendor lock-in, cost unknown, LGPD/data residency unverified, contradicts stage scope.
2. **Open enum with stub providers that throw** — rejected; invites accidental partial integrations; strict enum + fail-fast is clearer.
3. **Extractor logic inside HTTP route** — rejected; untestable, couples domain to HTTP and vendor.
4. **Allow silent fallback to fake when real provider fails** — rejected; production must not pretend extraction succeeded.

## Consequences

- **Positive**: Domain, contracts, mobile, and confirmation flow are stable before vendor spend; swap is an infrastructure change.
- **Positive**: Local dev and CI need no API keys; deterministic fake scenarios (`success`, `missing-item-value`, `total-mismatch`, `processing-failure`, `long-receipt`) exercise edge cases.
- **Negative**: No real OCR accuracy until a later benchmark stage.
- **Negative**: `RECEIPT_EXTRACTOR_PROVIDER` enum must be extended deliberately when adding providers — requires code + env schema update, not config-only plug-in.
