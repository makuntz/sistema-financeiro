import type { LedgerEntry, LedgerKind } from './ledger-entry.js';

export type LedgerEntryFilters = {
  kind?: LedgerKind;
  subcategoryId?: string;
  categoryId?: string;
  competenceYear?: number;
  competenceMonth?: number;
  occurredFrom?: string;
  occurredTo?: string;
  includeVoided?: boolean;
  voidedOnly?: boolean;
  attributedMemberId?: string;
  search?: string;
};

export type LedgerMonthlySummary = {
  totalIncomeInCents: bigint;
  totalExpenseInCents: bigint;
  entryCount: number;
};

export interface LedgerEntryRepository {
  findById(id: string): Promise<LedgerEntry | null>;
  findByIdAndWorkspace(id: string, workspaceId: string): Promise<LedgerEntry | null>;
  findByWorkspace(workspaceId: string, filters?: LedgerEntryFilters): Promise<LedgerEntry[]>;
  getMonthlySummary(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<LedgerMonthlySummary>;
}

export interface LedgerEntryStore {
  save(entry: LedgerEntry, expectedVersion: number | null): Promise<void>;
}
