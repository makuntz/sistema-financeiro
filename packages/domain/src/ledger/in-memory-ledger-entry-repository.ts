import { DomainError } from '../shared/domain-error.js';
import { LedgerEntry } from './ledger-entry.js';
import type {
  LedgerEntryRepository,
  LedgerEntryStore,
  LedgerEntryFilters,
  LedgerMonthlySummary,
} from './ledger-entry-repository.js';

export class InMemoryLedgerEntryRepository implements LedgerEntryRepository, LedgerEntryStore {
  readonly entries: LedgerEntry[] = [];

  async findById(id: string): Promise<LedgerEntry | null> {
    const found = this.entries.find((e) => e.id === id);
    return found ? LedgerEntry.reconstitute(found.toProps()) : null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<LedgerEntry | null> {
    const found = this.entries.find((e) => e.id === id && e.workspaceId === workspaceId);
    return found ? LedgerEntry.reconstitute(found.toProps()) : null;
  }

  async findByWorkspace(workspaceId: string, filters?: LedgerEntryFilters): Promise<LedgerEntry[]> {
    let results = this.entries.filter((e) => e.workspaceId === workspaceId);

    const voidedOnly = filters?.voidedOnly === true;
    const includeVoided = filters?.includeVoided === true;

    if (voidedOnly) {
      results = results.filter((e) => e.isVoided);
    } else if (!includeVoided) {
      results = results.filter((e) => !e.isVoided);
    }

    if (filters) {
      if (filters.kind) {
        results = results.filter((e) => e.kind === filters.kind);
      }
      if (filters.subcategoryId) {
        results = results.filter((e) => e.subcategoryId === filters.subcategoryId);
      }
      if (filters.categoryId) {
        results = results.filter((e) => e.categoryId === filters.categoryId);
      }
      if (filters.competenceYear !== undefined) {
        results = results.filter((e) => e.competenceYear === filters.competenceYear);
      }
      if (filters.competenceMonth !== undefined) {
        results = results.filter((e) => e.competenceMonth === filters.competenceMonth);
      }
      if (filters.occurredFrom) {
        results = results.filter((e) => e.occurredOn >= filters.occurredFrom!);
      }
      if (filters.occurredTo) {
        results = results.filter((e) => e.occurredOn <= filters.occurredTo!);
      }
      if (filters.attributedMemberId) {
        results = results.filter((e) => e.attributedMemberId === filters.attributedMemberId);
      }
      if (filters.search?.trim()) {
        const term = filters.search.trim().toLocaleLowerCase('pt-BR');
        results = results.filter(
          (e) =>
            e.description.toLocaleLowerCase('pt-BR').includes(term) ||
            (e.notes?.toLocaleLowerCase('pt-BR').includes(term) ?? false),
        );
      }
    }

    return results
      .sort((a, b) => {
        if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? 1 : -1;
        const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
        if (createdDiff !== 0) return createdDiff;
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      })
      .map((e) => LedgerEntry.reconstitute(e.toProps()));
  }

  async getMonthlySummary(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<LedgerMonthlySummary> {
    const entries = this.entries.filter(
      (e) =>
        e.workspaceId === workspaceId &&
        e.competenceYear === year &&
        e.competenceMonth === month &&
        !e.isVoided,
    );

    let totalIncomeInCents = 0n;
    let totalExpenseInCents = 0n;

    for (const entry of entries) {
      if (entry.kind === 'income') {
        totalIncomeInCents += entry.amountInCents;
      } else {
        totalExpenseInCents += entry.amountInCents;
      }
    }

    return {
      totalIncomeInCents,
      totalExpenseInCents,
      entryCount: entries.length,
    };
  }

  async save(entry: LedgerEntry, expectedVersion: number | null): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    const snapshot = LedgerEntry.reconstitute(entry.toProps());

    if (idx >= 0) {
      const storedVersion = this.entries[idx]!.version;
      if (expectedVersion !== null && storedVersion !== expectedVersion) {
        throw new DomainError(
          'LEDGER_ENTRY_VERSION_CONFLICT',
          'Este lançamento foi alterado por outra pessoa. Recarregue os dados antes de continuar.',
          { entryId: entry.id, expectedVersion },
        );
      }
      this.entries[idx] = snapshot;
    } else {
      this.entries.push(snapshot);
    }
  }
}
