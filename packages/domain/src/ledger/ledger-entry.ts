import { DomainError } from '../shared/domain-error.js';

export type LedgerKind = 'income' | 'expense';

export type LedgerEntryProps = {
  id: string;
  workspaceId: string;
  subcategoryId: string;
  categoryId: string;
  kind: LedgerKind;
  description: string;
  notes: string | null;
  amountInCents: bigint;
  occurredOn: string;
  competenceYear: number;
  competenceMonth: number;
  attributedMemberId: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  version: number;
  voidedAt: Date | null;
  voidedByUserId: string | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateLedgerEntryInput = {
  id: string;
  workspaceId: string;
  subcategoryId: string;
  categoryId: string;
  kind: LedgerKind;
  description: string;
  notes?: string | null;
  amountInCents: bigint;
  occurredOn: string;
  competenceYear: number;
  competenceMonth: number;
  attributedMemberId?: string | null;
  createdByUserId: string;
  now?: Date;
};

export class LedgerEntry {
  private constructor(private props: LedgerEntryProps) {}

  static create(input: CreateLedgerEntryInput): LedgerEntry {
    if (input.amountInCents <= 0n) {
      throw new DomainError('LEDGER_AMOUNT_INVALID', 'O valor deve ser maior que zero.', {
        amountInCents: input.amountInCents.toString(),
      });
    }

    if (input.competenceMonth < 1 || input.competenceMonth > 12) {
      throw new DomainError(
        'LEDGER_COMPETENCE_INVALID',
        'O mês de competência deve ser entre 1 e 12.',
        { competenceMonth: input.competenceMonth },
      );
    }

    if (input.competenceYear < 2000 || input.competenceYear > 2100) {
      throw new DomainError(
        'LEDGER_COMPETENCE_INVALID',
        'O ano de competência deve ser entre 2000 e 2100.',
        { competenceYear: input.competenceYear },
      );
    }

    if (!input.description || input.description.trim().length === 0) {
      throw new DomainError('LEDGER_DESCRIPTION_REQUIRED', 'A descrição é obrigatória.');
    }

    if (input.description.length > 255) {
      throw new DomainError(
        'LEDGER_DESCRIPTION_TOO_LONG',
        'A descrição deve ter no máximo 255 caracteres.',
      );
    }

    const notes = input.notes?.trim() ? input.notes.trim() : null;
    if (notes && notes.length > 2000) {
      throw new DomainError(
        'LEDGER_NOTES_TOO_LONG',
        'As observações devem ter no máximo 2000 caracteres.',
      );
    }

    const now = input.now ?? new Date();

    return new LedgerEntry({
      id: input.id,
      workspaceId: input.workspaceId,
      subcategoryId: input.subcategoryId,
      categoryId: input.categoryId,
      kind: input.kind,
      description: input.description.trim(),
      notes,
      amountInCents: input.amountInCents,
      occurredOn: input.occurredOn,
      competenceYear: input.competenceYear,
      competenceMonth: input.competenceMonth,
      attributedMemberId: input.attributedMemberId ?? null,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
      version: 1,
      voidedAt: null,
      voidedByUserId: null,
      voidReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: LedgerEntryProps): LedgerEntry {
    return new LedgerEntry(props);
  }

  get id(): string {
    return this.props.id;
  }
  get workspaceId(): string {
    return this.props.workspaceId;
  }
  get subcategoryId(): string {
    return this.props.subcategoryId;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get kind(): LedgerKind {
    return this.props.kind;
  }
  get description(): string {
    return this.props.description;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get amountInCents(): bigint {
    return this.props.amountInCents;
  }
  get occurredOn(): string {
    return this.props.occurredOn;
  }
  get competenceYear(): number {
    return this.props.competenceYear;
  }
  get competenceMonth(): number {
    return this.props.competenceMonth;
  }
  get attributedMemberId(): string | null {
    return this.props.attributedMemberId;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get updatedByUserId(): string {
    return this.props.updatedByUserId;
  }
  get version(): number {
    return this.props.version;
  }
  get voidedAt(): Date | null {
    return this.props.voidedAt;
  }
  get voidedByUserId(): string | null {
    return this.props.voidedByUserId;
  }
  get voidReason(): string | null {
    return this.props.voidReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get isVoided(): boolean {
    return this.props.voidedAt !== null;
  }

  update(
    input: {
      description?: string;
      notes?: string | null;
      amountInCents?: bigint;
      occurredOn?: string;
      competenceYear?: number;
      competenceMonth?: number;
      subcategoryId?: string;
      categoryId?: string;
      kind?: LedgerKind;
      attributedMemberId?: string | null;
    },
    actorUserId: string,
    now: Date = new Date(),
  ): void {
    if (this.isVoided) {
      throw new DomainError(
        'LEDGER_ENTRY_VOIDED',
        'Não é possível atualizar um lançamento excluído.',
        { entryId: this.id },
      );
    }

    if (input.description !== undefined) {
      if (!input.description || input.description.trim().length === 0) {
        throw new DomainError('LEDGER_DESCRIPTION_REQUIRED', 'A descrição é obrigatória.');
      }
      if (input.description.length > 255) {
        throw new DomainError(
          'LEDGER_DESCRIPTION_TOO_LONG',
          'A descrição deve ter no máximo 255 caracteres.',
        );
      }
      this.props.description = input.description.trim();
    }

    if (input.notes !== undefined) {
      const notes = input.notes?.trim() ? input.notes.trim() : null;
      if (notes && notes.length > 2000) {
        throw new DomainError(
          'LEDGER_NOTES_TOO_LONG',
          'As observações devem ter no máximo 2000 caracteres.',
        );
      }
      this.props.notes = notes;
    }

    if (input.amountInCents !== undefined) {
      if (input.amountInCents <= 0n) {
        throw new DomainError('LEDGER_AMOUNT_INVALID', 'O valor deve ser maior que zero.', {
          amountInCents: input.amountInCents.toString(),
        });
      }
      this.props.amountInCents = input.amountInCents;
    }

    if (input.occurredOn !== undefined) {
      this.props.occurredOn = input.occurredOn;
    }

    if (input.competenceYear !== undefined) {
      if (input.competenceYear < 2000 || input.competenceYear > 2100) {
        throw new DomainError(
          'LEDGER_COMPETENCE_INVALID',
          'O ano de competência deve ser entre 2000 e 2100.',
        );
      }
      this.props.competenceYear = input.competenceYear;
    }

    if (input.competenceMonth !== undefined) {
      if (input.competenceMonth < 1 || input.competenceMonth > 12) {
        throw new DomainError(
          'LEDGER_COMPETENCE_INVALID',
          'O mês de competência deve ser entre 1 e 12.',
        );
      }
      this.props.competenceMonth = input.competenceMonth;
    }

    if (input.subcategoryId !== undefined) {
      this.props.subcategoryId = input.subcategoryId;
    }

    if (input.categoryId !== undefined) {
      this.props.categoryId = input.categoryId;
    }

    if (input.kind !== undefined) {
      this.props.kind = input.kind;
    }

    if (input.attributedMemberId !== undefined) {
      this.props.attributedMemberId = input.attributedMemberId;
    }

    this.props.updatedByUserId = actorUserId;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  void(userId: string, reason?: string | null, now: Date = new Date()): void {
    if (this.isVoided) {
      throw new DomainError('LEDGER_ENTRY_ALREADY_VOIDED', 'O lançamento já está excluído.', {
        entryId: this.id,
      });
    }

    this.props.voidedAt = now;
    this.props.voidedByUserId = userId;
    this.props.voidReason = reason?.trim() ? reason.trim() : null;
    this.props.updatedByUserId = userId;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  restore(actorUserId: string, now: Date = new Date()): void {
    if (!this.isVoided) {
      throw new DomainError('LEDGER_ENTRY_NOT_VOIDED', 'O lançamento não está excluído.', {
        entryId: this.id,
      });
    }

    this.props.voidedAt = null;
    this.props.voidedByUserId = null;
    this.props.voidReason = null;
    this.props.updatedByUserId = actorUserId;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  toProps(): LedgerEntryProps {
    return { ...this.props };
  }
}
