import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerEntry } from './ledger-entry.js';
import { InMemoryLedgerEntryRepository } from './in-memory-ledger-entry-repository.js';
import { GetLedgerEntry } from './get-ledger-entry.js';
import { ListLedgerEntries } from './list-ledger-entries.js';
import { UpdateLedgerEntry } from './update-ledger-entry.js';
import { VoidLedgerEntry } from './void-ledger-entry.js';
import { RestoreLedgerEntry } from './restore-ledger-entry.js';
import { GetMonthlyLedgerSummary } from './get-monthly-ledger-summary.js';
import { InMemoryAuditLogger } from '../shared/audit.js';
import type { SubcategoryLookup, MemberLookup } from './create-ledger-entry.js';

function seedEntry(
  repo: InMemoryLedgerEntryRepository,
  overrides: Partial<Parameters<typeof LedgerEntry.create>[0]> = {},
) {
  const entry = LedgerEntry.create({
    id: 'entry-1',
    workspaceId: 'ws-1',
    subcategoryId: 'sub-1',
    categoryId: 'cat-1',
    kind: 'expense',
    description: 'Mercado',
    amountInCents: 15000n,
    occurredOn: '2026-07-15',
    competenceYear: 2026,
    competenceMonth: 7,
    createdByUserId: 'user-1',
    ...overrides,
  });
  repo.entries.push(LedgerEntry.reconstitute(entry.toProps()));
  return entry;
}

const subcategoryLookup: SubcategoryLookup = {
  async findSubcategoryForLedger(subcategoryId, workspaceId) {
    if (subcategoryId === 'sub-1' && workspaceId === 'ws-1') {
      return {
        id: 'sub-1',
        workspaceId: 'ws-1',
        categoryId: 'cat-1',
        categoryType: 'expense',
        isActive: true,
        categoryIsActive: true,
      };
    }
    if (subcategoryId === 'sub-income' && workspaceId === 'ws-1') {
      return {
        id: 'sub-income',
        workspaceId: 'ws-1',
        categoryId: 'cat-income',
        categoryType: 'income',
        isActive: true,
        categoryIsActive: true,
      };
    }
    return null;
  },
};

const memberLookup: MemberLookup = {
  async findMemberForLedger(memberId, workspaceId) {
    if (memberId === 'member-1' && workspaceId === 'ws-1') {
      return { id: 'member-1', workspaceId: 'ws-1', isActive: true };
    }
    return null;
  },
};

describe('GetLedgerEntry', () => {
  let repo: InMemoryLedgerEntryRepository;
  let useCase: GetLedgerEntry;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    useCase = new GetLedgerEntry(repo);
  });

  it('returns entry by id and workspace', async () => {
    seedEntry(repo);
    const entry = await useCase.execute({ entryId: 'entry-1', workspaceId: 'ws-1' });
    expect(entry.id).toBe('entry-1');
  });

  it('throws if not found', async () => {
    await expect(
      useCase.execute({ entryId: 'nonexistent', workspaceId: 'ws-1' }),
    ).rejects.toMatchObject({ code: 'LEDGER_ENTRY_NOT_FOUND' });
  });

  it('respects workspace isolation', async () => {
    seedEntry(repo);
    await expect(
      useCase.execute({ entryId: 'entry-1', workspaceId: 'ws-other' }),
    ).rejects.toMatchObject({ code: 'LEDGER_ENTRY_NOT_FOUND' });
  });
});

describe('ListLedgerEntries', () => {
  let repo: InMemoryLedgerEntryRepository;
  let useCase: ListLedgerEntries;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    useCase = new ListLedgerEntries(repo);
  });

  it('lists entries for workspace', async () => {
    seedEntry(repo, { id: 'e1' });
    seedEntry(repo, { id: 'e2' });
    seedEntry(repo, { id: 'e3', workspaceId: 'ws-other' });

    const results = await useCase.execute({ workspaceId: 'ws-1' });
    expect(results).toHaveLength(2);
  });

  it('excludes voided by default', async () => {
    seedEntry(repo);
    const voidUseCase = new VoidLedgerEntry(repo, repo);
    await voidUseCase.execute({
      entryId: 'entry-1',
      workspaceId: 'ws-1',
      reason: 'Erro',
      expectedVersion: 1,
      actorUserId: 'user-1',
    });
    const results = await useCase.execute({ workspaceId: 'ws-1' });
    expect(results).toHaveLength(0);
  });

  it('includes voided when specified', async () => {
    seedEntry(repo);
    const voidUseCase = new VoidLedgerEntry(repo, repo);
    await voidUseCase.execute({
      entryId: 'entry-1',
      workspaceId: 'ws-1',
      reason: 'Erro',
      expectedVersion: 1,
      actorUserId: 'user-1',
    });
    const results = await useCase.execute({
      workspaceId: 'ws-1',
      filters: { includeVoided: true },
    });
    expect(results).toHaveLength(1);
  });

  it('filters by kind', async () => {
    seedEntry(repo, { id: 'e1', kind: 'expense' });
    seedEntry(repo, { id: 'e2', kind: 'income' });
    const results = await useCase.execute({ workspaceId: 'ws-1', filters: { kind: 'income' } });
    expect(results).toHaveLength(1);
    expect(results[0]!.kind).toBe('income');
  });
});

describe('UpdateLedgerEntry', () => {
  let repo: InMemoryLedgerEntryRepository;
  let audit: InMemoryAuditLogger;
  let useCase: UpdateLedgerEntry;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    audit = new InMemoryAuditLogger();
    useCase = new UpdateLedgerEntry(repo, repo, subcategoryLookup, memberLookup, audit);
  });

  it('updates description and bumps version', async () => {
    seedEntry(repo);
    const updated = await useCase.execute({
      entryId: 'entry-1',
      workspaceId: 'ws-1',
      description: 'Atualizado',
      expectedVersion: 1,
      actorUserId: 'user-1',
    });
    expect(updated.description).toBe('Atualizado');
    expect(updated.version).toBe(2);
    expect(audit.events[0]!.name).toBe('LedgerEntryUpdated');
  });

  it('rejects version conflict', async () => {
    seedEntry(repo);
    await expect(
      useCase.execute({
        entryId: 'entry-1',
        workspaceId: 'ws-1',
        description: 'Test',
        expectedVersion: 99,
        actorUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'LEDGER_ENTRY_VERSION_CONFLICT' });
  });

  it('rejects kind mismatch on subcategory change', async () => {
    seedEntry(repo);
    await expect(
      useCase.execute({
        entryId: 'entry-1',
        workspaceId: 'ws-1',
        subcategoryId: 'sub-income',
        expectedVersion: 1,
        actorUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'LEDGER_KIND_MISMATCH' });
  });
});

describe('VoidLedgerEntry', () => {
  let repo: InMemoryLedgerEntryRepository;
  let audit: InMemoryAuditLogger;
  let useCase: VoidLedgerEntry;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    audit = new InMemoryAuditLogger();
    useCase = new VoidLedgerEntry(repo, repo, audit);
  });

  it('voids entry', async () => {
    seedEntry(repo);
    const voided = await useCase.execute({
      entryId: 'entry-1',
      workspaceId: 'ws-1',
      reason: 'Duplicado',
      expectedVersion: 1,
      actorUserId: 'user-2',
    });
    expect(voided.isVoided).toBe(true);
    expect(voided.voidReason).toBe('Duplicado');
    expect(audit.events[0]!.name).toBe('LedgerEntryVoided');
  });

  it('rejects if not found', async () => {
    await expect(
      useCase.execute({
        entryId: 'nonexistent',
        workspaceId: 'ws-1',
        reason: 'Test',
        expectedVersion: 1,
        actorUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'LEDGER_ENTRY_NOT_FOUND' });
  });
});

describe('RestoreLedgerEntry', () => {
  let repo: InMemoryLedgerEntryRepository;
  let audit: InMemoryAuditLogger;
  let useCase: RestoreLedgerEntry;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    audit = new InMemoryAuditLogger();
    useCase = new RestoreLedgerEntry(repo, repo, audit);
  });

  it('restores voided entry', async () => {
    seedEntry(repo);
    const voidUseCase = new VoidLedgerEntry(repo, repo);
    await voidUseCase.execute({
      entryId: 'entry-1',
      workspaceId: 'ws-1',
      reason: 'Erro',
      expectedVersion: 1,
      actorUserId: 'user-1',
    });
    const restored = await useCase.execute({
      entryId: 'entry-1',
      workspaceId: 'ws-1',
      expectedVersion: 2,
      actorUserId: 'user-1',
    });
    expect(restored.isVoided).toBe(false);
    expect(audit.events[0]!.name).toBe('LedgerEntryRestored');
  });
});

describe('GetMonthlyLedgerSummary', () => {
  let repo: InMemoryLedgerEntryRepository;
  let useCase: GetMonthlyLedgerSummary;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    useCase = new GetMonthlyLedgerSummary(repo);
  });

  it('sums income and expense for month', async () => {
    seedEntry(repo, { id: 'e1', kind: 'expense', amountInCents: 10000n });
    seedEntry(repo, { id: 'e2', kind: 'expense', amountInCents: 5000n });
    seedEntry(repo, { id: 'e3', kind: 'income', amountInCents: 80000n });

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });
    expect(result.totalExpenseInCents).toBe(15000n);
    expect(result.totalIncomeInCents).toBe(80000n);
    expect(result.balanceInCents).toBe(65000n);
    expect(result.entryCount).toBe(3);
  });

  it('excludes voided entries from summary', async () => {
    seedEntry(repo, { id: 'e1', kind: 'expense', amountInCents: 10000n });
    const voidUseCase = new VoidLedgerEntry(repo, repo);
    await voidUseCase.execute({
      entryId: 'e1',
      workspaceId: 'ws-1',
      reason: 'Erro',
      expectedVersion: 1,
      actorUserId: 'user-1',
    });
    seedEntry(repo, { id: 'e2', kind: 'expense', amountInCents: 5000n });

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });
    expect(result.totalExpenseInCents).toBe(5000n);
    expect(result.entryCount).toBe(1);
  });

  it('returns zeros for empty month', async () => {
    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 12 });
    expect(result.totalIncomeInCents).toBe(0n);
    expect(result.totalExpenseInCents).toBe(0n);
    expect(result.entryCount).toBe(0);
  });
});
