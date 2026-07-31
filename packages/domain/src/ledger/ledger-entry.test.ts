import { describe, it, expect } from 'vitest';
import { LedgerEntry } from './ledger-entry.js';
import { DomainError } from '../shared/domain-error.js';

function makeEntry(overrides: Partial<Parameters<typeof LedgerEntry.create>[0]> = {}) {
  return LedgerEntry.create({
    id: 'entry-1',
    workspaceId: 'ws-1',
    subcategoryId: 'sub-1',
    categoryId: 'cat-1',
    kind: 'expense',
    description: 'Compra mercado',
    amountInCents: 15000n,
    occurredOn: '2026-07-15',
    competenceYear: 2026,
    competenceMonth: 7,
    createdByUserId: 'user-1',
    ...overrides,
  });
}

function expectDomainCode(fn: () => unknown, code: string) {
  try {
    fn();
    expect.fail(`Expected DomainError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
  }
}

describe('LedgerEntry', () => {
  describe('create', () => {
    it('creates a valid entry', () => {
      const entry = makeEntry();
      expect(entry.id).toBe('entry-1');
      expect(entry.kind).toBe('expense');
      expect(entry.amountInCents).toBe(15000n);
      expect(entry.version).toBe(1);
      expect(entry.isVoided).toBe(false);
      expect(entry.updatedByUserId).toBe('user-1');
      expect(entry.notes).toBeNull();
    });

    it('rejects zero amount', () => {
      expectDomainCode(() => makeEntry({ amountInCents: 0n }), 'LEDGER_AMOUNT_INVALID');
    });

    it('rejects negative amount', () => {
      expectDomainCode(() => makeEntry({ amountInCents: -100n }), 'LEDGER_AMOUNT_INVALID');
    });

    it('rejects invalid competence month', () => {
      expectDomainCode(() => makeEntry({ competenceMonth: 0 }), 'LEDGER_COMPETENCE_INVALID');
      expectDomainCode(() => makeEntry({ competenceMonth: 13 }), 'LEDGER_COMPETENCE_INVALID');
    });

    it('rejects invalid competence year', () => {
      expectDomainCode(() => makeEntry({ competenceYear: 1999 }), 'LEDGER_COMPETENCE_INVALID');
      expectDomainCode(() => makeEntry({ competenceYear: 2101 }), 'LEDGER_COMPETENCE_INVALID');
    });

    it('rejects empty description', () => {
      expectDomainCode(() => makeEntry({ description: '' }), 'LEDGER_DESCRIPTION_REQUIRED');
      expectDomainCode(() => makeEntry({ description: '   ' }), 'LEDGER_DESCRIPTION_REQUIRED');
    });

    it('rejects long description', () => {
      expectDomainCode(
        () => makeEntry({ description: 'a'.repeat(256) }),
        'LEDGER_DESCRIPTION_TOO_LONG',
      );
    });

    it('sets attributedMemberId to null by default', () => {
      const entry = makeEntry();
      expect(entry.attributedMemberId).toBeNull();
    });

    it('sets attributedMemberId when provided', () => {
      const entry = makeEntry({ attributedMemberId: 'member-1' });
      expect(entry.attributedMemberId).toBe('member-1');
    });
  });

  describe('update', () => {
    it('bumps version', () => {
      const entry = makeEntry();
      entry.update({ description: 'Nova desc' }, 'user-1');
      expect(entry.version).toBe(2);
      expect(entry.description).toBe('Nova desc');
      expect(entry.updatedByUserId).toBe('user-1');
    });

    it('validates new amount', () => {
      const entry = makeEntry();
      expectDomainCode(
        () => entry.update({ amountInCents: 0n }, 'user-1'),
        'LEDGER_AMOUNT_INVALID',
      );
    });

    it('cannot update voided entry', () => {
      const entry = makeEntry();
      entry.void('user-1', 'Erro');
      expectDomainCode(() => entry.update({ description: 'x' }, 'user-1'), 'LEDGER_ENTRY_VOIDED');
    });
  });

  describe('void', () => {
    it('marks entry as voided', () => {
      const entry = makeEntry();
      entry.void('user-2', 'Duplicado');
      expect(entry.isVoided).toBe(true);
      expect(entry.voidedByUserId).toBe('user-2');
      expect(entry.voidReason).toBe('Duplicado');
      expect(entry.version).toBe(2);
    });

    it('cannot void already voided entry', () => {
      const entry = makeEntry();
      entry.void('user-1', 'Motivo');
      expectDomainCode(() => entry.void('user-1', 'Outro motivo'), 'LEDGER_ENTRY_ALREADY_VOIDED');
    });

    it('allows optional reason', () => {
      const entry = makeEntry();
      entry.void('user-1');
      expect(entry.isVoided).toBe(true);
      expect(entry.voidReason).toBeNull();
    });
  });

  describe('restore', () => {
    it('restores voided entry', () => {
      const entry = makeEntry();
      entry.void('user-1', 'Erro');
      entry.restore('user-2');
      expect(entry.isVoided).toBe(false);
      expect(entry.voidedAt).toBeNull();
      expect(entry.voidedByUserId).toBeNull();
      expect(entry.voidReason).toBeNull();
      expect(entry.updatedByUserId).toBe('user-2');
      expect(entry.version).toBe(3);
    });

    it('cannot restore non-voided entry', () => {
      const entry = makeEntry();
      expectDomainCode(() => entry.restore('user-1'), 'LEDGER_ENTRY_NOT_VOIDED');
    });
  });

  describe('reconstitute', () => {
    it('rebuilds from props', () => {
      const entry = makeEntry();
      const reconstructed = LedgerEntry.reconstitute(entry.toProps());
      expect(reconstructed.id).toBe(entry.id);
      expect(reconstructed.amountInCents).toBe(entry.amountInCents);
      expect(reconstructed.version).toBe(entry.version);
    });
  });
});
