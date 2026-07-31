import { DomainError } from '../shared/domain-error.js';
import type { LedgerEntry } from './ledger-entry.js';
import type { LedgerEntryRepository, LedgerEntryStore } from './ledger-entry-repository.js';
import type { AuditLogger } from '../shared/audit.js';

export type VoidLedgerEntryInput = {
  entryId: string;
  workspaceId: string;
  reason?: string | null;
  expectedVersion: number;
  actorUserId: string;
};

export class VoidLedgerEntry {
  constructor(
    private readonly repository: LedgerEntryRepository,
    private readonly store: LedgerEntryStore,
    private readonly auditLogger?: AuditLogger,
  ) {}

  async execute(input: VoidLedgerEntryInput): Promise<LedgerEntry> {
    const entry = await this.repository.findByIdAndWorkspace(input.entryId, input.workspaceId);

    if (!entry) {
      throw new DomainError('LEDGER_ENTRY_NOT_FOUND', 'Lançamento não encontrado.', {
        entryId: input.entryId,
      });
    }

    entry.void(input.actorUserId, input.reason);

    await this.store.save(entry, input.expectedVersion);

    await this.auditLogger?.record({
      name: 'LedgerEntryVoided',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        entryId: entry.id,
        reason: input.reason ?? null,
        newVersion: entry.version,
      },
    });

    return entry;
  }
}
