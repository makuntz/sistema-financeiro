import { DomainError } from '../shared/domain-error.js';
import type { LedgerEntry } from './ledger-entry.js';
import type { LedgerEntryRepository } from './ledger-entry-repository.js';

export type GetLedgerEntryInput = {
  entryId: string;
  workspaceId: string;
};

export class GetLedgerEntry {
  constructor(private readonly repository: LedgerEntryRepository) {}

  async execute(input: GetLedgerEntryInput): Promise<LedgerEntry> {
    const entry = await this.repository.findByIdAndWorkspace(input.entryId, input.workspaceId);

    if (!entry) {
      throw new DomainError('LEDGER_ENTRY_NOT_FOUND', 'Lançamento não encontrado.', {
        entryId: input.entryId,
      });
    }

    return entry;
  }
}
