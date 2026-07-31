import { DomainError } from '../shared/domain-error.js';
import { LedgerEntry, type LedgerKind } from './ledger-entry.js';
import type { LedgerEntryStore } from './ledger-entry-repository.js';
import type { AuditLogger } from '../shared/audit.js';

export type SubcategoryInfo = {
  id: string;
  workspaceId: string;
  categoryId: string;
  categoryType: 'income' | 'expense';
  isActive: boolean;
  categoryIsActive: boolean;
};

export type MemberInfo = {
  id: string;
  workspaceId: string;
  isActive: boolean;
};

export interface SubcategoryLookup {
  findSubcategoryForLedger(
    subcategoryId: string,
    workspaceId: string,
  ): Promise<SubcategoryInfo | null>;
}

export interface MemberLookup {
  findMemberForLedger(memberId: string, workspaceId: string): Promise<MemberInfo | null>;
}

export type CreateLedgerEntryInput = {
  id: string;
  workspaceId: string;
  subcategoryId: string;
  description: string;
  notes?: string | null;
  amountInCents: bigint;
  occurredOn: string;
  competenceYear?: number;
  competenceMonth?: number;
  attributedMemberId?: string;
  createdByUserId: string;
};

export class CreateLedgerEntry {
  constructor(
    private readonly store: LedgerEntryStore,
    private readonly subcategoryLookup: SubcategoryLookup,
    private readonly memberLookup: MemberLookup,
    private readonly auditLogger?: AuditLogger,
  ) {}

  async execute(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const subcategory = await this.subcategoryLookup.findSubcategoryForLedger(
      input.subcategoryId,
      input.workspaceId,
    );

    if (!subcategory) {
      throw new DomainError(
        'LEDGER_SUBCATEGORY_NOT_FOUND',
        'Subcategoria não encontrada neste workspace.',
        { subcategoryId: input.subcategoryId },
      );
    }

    if (!subcategory.isActive) {
      throw new DomainError(
        'LEDGER_SUBCATEGORY_INACTIVE',
        'Não é possível criar lançamento com subcategoria arquivada.',
        { subcategoryId: input.subcategoryId },
      );
    }

    if (!subcategory.categoryIsActive) {
      throw new DomainError(
        'LEDGER_CATEGORY_INACTIVE',
        'Não é possível criar lançamento com categoria arquivada.',
        { categoryId: subcategory.categoryId },
      );
    }

    const kind: LedgerKind = subcategory.categoryType;

    if (input.attributedMemberId) {
      const member = await this.memberLookup.findMemberForLedger(
        input.attributedMemberId,
        input.workspaceId,
      );
      if (!member) {
        throw new DomainError(
          'LEDGER_MEMBER_NOT_FOUND',
          'Membro atribuído não encontrado neste workspace.',
          { memberId: input.attributedMemberId },
        );
      }
      if (!member.isActive) {
        throw new DomainError(
          'LEDGER_MEMBER_INACTIVE',
          'Não é possível atribuir a um membro inativo.',
          { memberId: input.attributedMemberId },
        );
      }
    }

    let competenceYear = input.competenceYear;
    let competenceMonth = input.competenceMonth;

    if (competenceYear === undefined || competenceMonth === undefined) {
      const parts = input.occurredOn.split('-');
      competenceYear = competenceYear ?? Number(parts[0]);
      competenceMonth = competenceMonth ?? Number(parts[1]);
    }

    const entry = LedgerEntry.create({
      id: input.id,
      workspaceId: input.workspaceId,
      subcategoryId: input.subcategoryId,
      categoryId: subcategory.categoryId,
      kind,
      description: input.description,
      notes: input.notes,
      amountInCents: input.amountInCents,
      occurredOn: input.occurredOn,
      competenceYear,
      competenceMonth,
      attributedMemberId: input.attributedMemberId ?? null,
      createdByUserId: input.createdByUserId,
    });

    await this.store.save(entry, null);

    await this.auditLogger?.record({
      name: 'LedgerEntryCreated',
      actorUserId: input.createdByUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        entryId: entry.id,
        kind: entry.kind,
        competenceYear: entry.competenceYear,
        competenceMonth: entry.competenceMonth,
        previousVersion: null,
        newVersion: entry.version,
      },
    });

    return entry;
  }
}
