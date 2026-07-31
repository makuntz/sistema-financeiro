import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreateLedgerEntry,
  type SubcategoryLookup,
  type MemberLookup,
} from './create-ledger-entry.js';
import { InMemoryLedgerEntryRepository } from './in-memory-ledger-entry-repository.js';
import { InMemoryAuditLogger } from '../shared/audit.js';

const makeSubcategoryLookup = (): SubcategoryLookup => ({
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
});

const makeMemberLookup = (): MemberLookup => ({
  async findMemberForLedger(memberId, workspaceId) {
    if (memberId === 'member-1' && workspaceId === 'ws-1') {
      return { id: 'member-1', workspaceId: 'ws-1', isActive: true };
    }
    if (memberId === 'member-inactive' && workspaceId === 'ws-1') {
      return { id: 'member-inactive', workspaceId: 'ws-1', isActive: false };
    }
    return null;
  },
});

describe('CreateLedgerEntry', () => {
  let repo: InMemoryLedgerEntryRepository;
  let audit: InMemoryAuditLogger;
  let useCase: CreateLedgerEntry;

  beforeEach(() => {
    repo = new InMemoryLedgerEntryRepository();
    audit = new InMemoryAuditLogger();
    useCase = new CreateLedgerEntry(repo, makeSubcategoryLookup(), makeMemberLookup(), audit);
  });

  it('creates entry with derived kind from category type', async () => {
    const entry = await useCase.execute({
      id: 'e-1',
      workspaceId: 'ws-1',
      subcategoryId: 'sub-1',
      description: 'Mercado',
      amountInCents: 10000n,
      occurredOn: '2026-07-15',
      createdByUserId: 'user-1',
    });

    expect(entry.kind).toBe('expense');
    expect(entry.categoryId).toBe('cat-1');
    expect(entry.competenceYear).toBe(2026);
    expect(entry.competenceMonth).toBe(7);
    expect(repo.entries).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]!.name).toBe('LedgerEntryCreated');
  });

  it('derives competence from occurredOn when not provided', async () => {
    const entry = await useCase.execute({
      id: 'e-2',
      workspaceId: 'ws-1',
      subcategoryId: 'sub-1',
      description: 'Padaria',
      amountInCents: 5000n,
      occurredOn: '2026-03-10',
      createdByUserId: 'user-1',
    });

    expect(entry.competenceYear).toBe(2026);
    expect(entry.competenceMonth).toBe(3);
  });

  it('allows explicit competence override', async () => {
    const entry = await useCase.execute({
      id: 'e-3',
      workspaceId: 'ws-1',
      subcategoryId: 'sub-1',
      description: 'Compra antecipada',
      amountInCents: 7500n,
      occurredOn: '2026-07-30',
      competenceYear: 2026,
      competenceMonth: 8,
      createdByUserId: 'user-1',
    });

    expect(entry.competenceYear).toBe(2026);
    expect(entry.competenceMonth).toBe(8);
  });

  it('creates income entry', async () => {
    const entry = await useCase.execute({
      id: 'e-4',
      workspaceId: 'ws-1',
      subcategoryId: 'sub-income',
      description: 'Salário',
      amountInCents: 800000n,
      occurredOn: '2026-07-05',
      createdByUserId: 'user-1',
    });

    expect(entry.kind).toBe('income');
    expect(entry.categoryId).toBe('cat-income');
  });

  it('rejects unknown subcategory', async () => {
    await expect(
      useCase.execute({
        id: 'e-5',
        workspaceId: 'ws-1',
        subcategoryId: 'unknown-sub',
        description: 'Test',
        amountInCents: 100n,
        occurredOn: '2026-07-01',
        createdByUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'LEDGER_SUBCATEGORY_NOT_FOUND' });
  });

  it('validates attributed member exists and is active', async () => {
    await expect(
      useCase.execute({
        id: 'e-6',
        workspaceId: 'ws-1',
        subcategoryId: 'sub-1',
        description: 'Test',
        amountInCents: 100n,
        occurredOn: '2026-07-01',
        attributedMemberId: 'nonexistent',
        createdByUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'LEDGER_MEMBER_NOT_FOUND' });
  });

  it('rejects inactive member', async () => {
    await expect(
      useCase.execute({
        id: 'e-7',
        workspaceId: 'ws-1',
        subcategoryId: 'sub-1',
        description: 'Test',
        amountInCents: 100n,
        occurredOn: '2026-07-01',
        attributedMemberId: 'member-inactive',
        createdByUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'LEDGER_MEMBER_INACTIVE' });
  });

  it('accepts active member attribution', async () => {
    const entry = await useCase.execute({
      id: 'e-8',
      workspaceId: 'ws-1',
      subcategoryId: 'sub-1',
      description: 'Compra atribuída',
      amountInCents: 5000n,
      occurredOn: '2026-07-01',
      attributedMemberId: 'member-1',
      createdByUserId: 'user-1',
    });

    expect(entry.attributedMemberId).toBe('member-1');
  });
});
