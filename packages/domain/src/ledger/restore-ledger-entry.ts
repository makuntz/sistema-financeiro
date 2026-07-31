import { DomainError } from '../shared/domain-error.js';
import type { LedgerEntry } from './ledger-entry.js';
import type { LedgerEntryRepository, LedgerEntryStore } from './ledger-entry-repository.js';
import type { AuditLogger } from '../shared/audit.js';

export type RestoreLedgerEntryInput = {
  entryId: string;
  workspaceId: string;
  expectedVersion: number;
  actorUserId: string;
};

export class RestoreLedgerEntry {
  constructor(
    private readonly repository: LedgerEntryRepository,
    private readonly store: LedgerEntryStore,
    private readonly auditLogger?: AuditLogger,
  ) {}

  async execute(input: RestoreLedgerEntryInput): Promise<LedgerEntry> {
    const entry = await this.repository.findByIdAndWorkspace(input.entryId, input.workspaceId);

    if (!entry) {
      throw new DomainError('LEDGER_ENTRY_NOT_FOUND', 'Lançamento não encontrado.', {
        entryId: input.entryId,
      });
    }

    entry.restore(input.actorUserId);

    await this.store.save(entry, input.expectedVersion);

    await this.auditLogger?.record({
      name: 'LedgerEntryRestored',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        entryId: entry.id,
        newVersion: entry.version,
      },
    });

    return entry;
  }
}
