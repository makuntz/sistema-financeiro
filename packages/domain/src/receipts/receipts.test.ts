import { describe, expect, it } from 'vitest';
import { ReceiptCapture } from './receipt-capture.js';
import { ReceiptItem } from './receipt-item.js';
import {
  FakeReceiptExtractor,
  assertReadyForConfirmation,
  createReceiptExtractor,
  groupItemsBySubcategory,
  isWithinTotalTolerance,
  sumNonIgnoredLineTotals,
} from './receipt-extractor.js';
import { DomainError } from '../shared/domain-error.js';

describe('ReceiptCapture state machine', () => {
  it('creates draft and follows happy path to confirmed', () => {
    const capture = ReceiptCapture.create({
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      createdByUserId: '33333333-3333-4333-8333-333333333333',
    });
    expect(capture.status).toBe('draft');
    capture.markUploaded();
    capture.startProcessing();
    capture.markReview({
      merchantName: 'Supermercado Exemplo',
      purchaseDate: '2026-08-01',
      totalAmountInCents: 13220n,
    });
    expect(capture.status).toBe('review');
    capture.confirm('33333333-3333-4333-8333-333333333333');
    expect(capture.status).toBe('confirmed');
  });

  it('rejects invalid transitions and double confirm', () => {
    const capture = ReceiptCapture.create({
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      createdByUserId: '33333333-3333-4333-8333-333333333333',
    });
    expect(() => capture.confirm('33333333-3333-4333-8333-333333333333')).toThrow(DomainError);
    capture.markUploaded();
    capture.startProcessing();
    capture.markReview({
      merchantName: null,
      purchaseDate: '2026-08-01',
      totalAmountInCents: 100n,
    });
    capture.confirm('33333333-3333-4333-8333-333333333333');
    expect(() =>
      capture.markReview({
        merchantName: null,
        purchaseDate: '2026-08-01',
        totalAmountInCents: 100n,
      }),
    ).toThrow(/invalid|inválida/i);
  });
});

describe('FakeReceiptExtractor', () => {
  const extractor = new FakeReceiptExtractor();
  const baseInput = {
    captureId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    imageStorageKeys: ['key'],
    mimeTypes: ['image/jpeg'],
  };

  it('returns deterministic success payload', async () => {
    const a = await extractor.extract(baseInput);
    const b = await extractor.extract(baseInput);
    expect(a).toEqual(b);
    expect(a.merchantName).toBe('Supermercado Exemplo');
    expect(a.totalAmountInCents).toBe('13220');
    expect(a.items).toHaveLength(4);
  });

  it('supports failure and mismatch scenarios', async () => {
    await expect(
      extractor.extract({ ...baseInput, fakeScenario: 'processing-failure' }),
    ).rejects.toBeInstanceOf(DomainError);

    const mismatch = await extractor.extract({ ...baseInput, fakeScenario: 'total-mismatch' });
    expect(mismatch.totalAmountInCents).toBe('15000');

    const missing = await extractor.extract({ ...baseInput, fakeScenario: 'missing-item-value' });
    expect(missing.items.some((i) => i.lineTotalInCents == null)).toBe(true);
  });

  it('rejects unknown providers', () => {
    expect(() => createReceiptExtractor('openai')).toThrow(/fake/i);
  });
});

describe('receipt grouping and confirmation readiness', () => {
  const captureId = '11111111-1111-4111-8111-111111111111';
  const workspaceId = '22222222-2222-4222-8222-222222222222';

  function item(partial: {
    id: string;
    position: number;
    total: bigint | null;
    subcategoryId?: string | null;
    ignored?: boolean;
  }) {
    const created = ReceiptItem.create({
      id: partial.id,
      workspaceId,
      receiptCaptureId: captureId,
      position: partial.position,
      rawDescription: `Item ${partial.position}`,
      lineTotalInCents: partial.total ?? undefined,
    });
    if (partial.subcategoryId) created.assignSubcategory(partial.subcategoryId);
    if (partial.ignored) created.ignore();
    return created;
  }

  it('groups by subcategory and ignores ignored items', () => {
    const items = [
      item({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        position: 1,
        total: 1000n,
        subcategoryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
      item({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        position: 2,
        total: 2000n,
        subcategoryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
      item({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        position: 3,
        total: 500n,
        subcategoryId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      }),
      item({
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        position: 4,
        total: 999n,
        ignored: true,
      }),
    ];
    const groups = groupItemsBySubcategory(items);
    expect(groups).toHaveLength(2);
    expect(
      sumNonIgnoredLineTotals(
        items.map((i) => ({ isIgnored: i.isIgnored, lineTotalInCents: i.lineTotalInCents })),
      ),
    ).toBe(3500n);
  });

  it('enforces total tolerance of 2 cents', () => {
    expect(isWithinTotalTolerance(2n)).toBe(true);
    expect(isWithinTotalTolerance(3n)).toBe(false);
  });

  it('blocks confirmation when items are incomplete or total mismatches', () => {
    const unassigned = item({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      position: 1,
      total: 1000n,
    });
    expect(() =>
      assertReadyForConfirmation({ captureTotalInCents: 1000n, items: [unassigned] }),
    ).toThrow(/subcategoria/i);

    const ready = item({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      position: 1,
      total: 1000n,
      subcategoryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(() =>
      assertReadyForConfirmation({ captureTotalInCents: 1500n, items: [ready] }),
    ).toThrow(/total/i);

    const ok = assertReadyForConfirmation({ captureTotalInCents: 1000n, items: [ready] });
    expect(ok.groups).toHaveLength(1);
  });
});
