import type { LedgerEntry } from './ledger-entry.js';
import type { LedgerEntryRepository, LedgerEntryFilters } from './ledger-entry-repository.js';

export type ListLedgerEntriesInput = {
  workspaceId: string;
  filters?: LedgerEntryFilters;
};

export class ListLedgerEntries {
  constructor(private readonly repository: LedgerEntryRepository) {}

  async execute(input: ListLedgerEntriesInput): Promise<LedgerEntry[]> {
    return this.repository.findByWorkspace(input.workspaceId, input.filters);
  }
}
