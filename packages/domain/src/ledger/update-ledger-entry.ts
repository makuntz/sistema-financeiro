import { DomainError } from '../shared/domain-error.js';
import type { LedgerEntry } from './ledger-entry.js';
import type { LedgerEntryRepository, LedgerEntryStore } from './ledger-entry-repository.js';
import type { SubcategoryLookup, MemberLookup } from './create-ledger-entry.js';
import type { AuditLogger } from '../shared/audit.js';

export type UpdateLedgerEntryInput = {
  entryId: string;
  workspaceId: string;
  description?: string;
  notes?: string | null;
  amountInCents?: bigint;
  occurredOn?: string;
  competenceYear?: number;
  competenceMonth?: number;
  subcategoryId?: string;
  attributedMemberId?: string | null;
  expectedVersion: number;
  actorUserId: string;
};

export class UpdateLedgerEntry {
  constructor(
    private readonly repository: LedgerEntryRepository,
    private readonly store: LedgerEntryStore,
    private readonly subcategoryLookup: SubcategoryLookup,
    private readonly memberLookup: MemberLookup,
    private readonly auditLogger?: AuditLogger,
  ) {}

  async execute(input: UpdateLedgerEntryInput): Promise<LedgerEntry> {
    const entry = await this.repository.findByIdAndWorkspace(input.entryId, input.workspaceId);

    if (!entry) {
      throw new DomainError('LEDGER_ENTRY_NOT_FOUND', 'Lançamento não encontrado.', {
        entryId: input.entryId,
      });
    }

    const previousVersion = entry.version;
    const changedFields: string[] = [];

    let newSubcategoryId = input.subcategoryId;
    let newCategoryId: string | undefined;
    let newKind: 'income' | 'expense' | undefined;

    if (newSubcategoryId && newSubcategoryId !== entry.subcategoryId) {
      const subcategory = await this.subcategoryLookup.findSubcategoryForLedger(
        newSubcategoryId,
        input.workspaceId,
      );
      if (!subcategory) {
        throw new DomainError(
          'LEDGER_SUBCATEGORY_NOT_FOUND',
          'Subcategoria não encontrada neste workspace.',
          { subcategoryId: newSubcategoryId },
        );
      }
      if (!subcategory.isActive) {
        throw new DomainError(
          'LEDGER_SUBCATEGORY_INACTIVE',
          'Não é possível reclassificar para subcategoria arquivada.',
          { subcategoryId: newSubcategoryId },
        );
      }
      if (!subcategory.categoryIsActive) {
        throw new DomainError(
          'LEDGER_CATEGORY_INACTIVE',
          'Não é possível reclassificar para categoria arquivada.',
          { categoryId: subcategory.categoryId },
        );
      }
      const derivedKind = subcategory.categoryType;
      if (derivedKind !== entry.kind) {
        throw new DomainError(
          'LEDGER_KIND_MISMATCH',
          'Não é possível alterar a subcategoria para um tipo diferente (receita/despesa).',
          { currentKind: entry.kind, newKind: derivedKind },
        );
      }
      newCategoryId = subcategory.categoryId;
      newKind = derivedKind;
      changedFields.push('subcategoryId');
    } else {
      newSubcategoryId = undefined;
    }

    if (input.attributedMemberId !== undefined && input.attributedMemberId !== null) {
      if (input.attributedMemberId !== entry.attributedMemberId) {
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
      changedFields.push('attributedMemberId');
    }

    if (input.description !== undefined) changedFields.push('description');
    if (input.notes !== undefined) changedFields.push('notes');
    if (input.amountInCents !== undefined) changedFields.push('amountInCents');
    if (input.occurredOn !== undefined) changedFields.push('occurredOn');
    if (input.competenceYear !== undefined) changedFields.push('competenceYear');
    if (input.competenceMonth !== undefined) changedFields.push('competenceMonth');

    entry.update(
      {
        description: input.description,
        notes: input.notes,
        amountInCents: input.amountInCents,
        occurredOn: input.occurredOn,
        competenceYear: input.competenceYear,
        competenceMonth: input.competenceMonth,
        subcategoryId: newSubcategoryId,
        categoryId: newCategoryId,
        kind: newKind,
        attributedMemberId: input.attributedMemberId,
      },
      input.actorUserId,
    );

    await this.store.save(entry, input.expectedVersion);

    await this.auditLogger?.record({
      name: 'LedgerEntryUpdated',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        entryId: entry.id,
        kind: entry.kind,
        competenceYear: entry.competenceYear,
        competenceMonth: entry.competenceMonth,
        previousVersion,
        newVersion: entry.version,
        changedFields: changedFields.join(','),
      },
    });

    return entry;
  }
}
