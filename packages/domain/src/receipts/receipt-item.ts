import { DomainError } from '../shared/domain-error.js';

export type ReceiptItemProps = {
  id: string;
  workspaceId: string;
  receiptCaptureId: string;
  position: number;
  rawDescription: string;
  normalizedDescription: string | null;
  quantity: string | null;
  unitOfMeasure: string | null;
  unitPriceInCents: bigint | null;
  lineTotalInCents: bigint | null;
  selectedSubcategoryId: string | null;
  isIgnored: boolean;
  needsReview: boolean;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
};

export class ReceiptItem {
  private constructor(private props: ReceiptItemProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    receiptCaptureId: string;
    position: number;
    rawDescription: string;
    normalizedDescription?: string | null;
    quantity?: string | null;
    unitOfMeasure?: string | null;
    unitPriceInCents?: bigint | null;
    lineTotalInCents?: bigint | null;
    needsReview?: boolean;
    warnings?: string[];
    now?: Date;
  }): ReceiptItem {
    const now = input.now ?? new Date();
    const raw = input.rawDescription.trim();
    if (!raw) {
      throw new DomainError('RECEIPT_ITEM_INVALID', 'A descrição do item é obrigatória.');
    }
    if (
      input.lineTotalInCents !== undefined &&
      input.lineTotalInCents !== null &&
      input.lineTotalInCents <= 0n
    ) {
      throw new DomainError('RECEIPT_ITEM_INVALID', 'O valor do item deve ser maior que zero.');
    }

    return new ReceiptItem({
      id: input.id,
      workspaceId: input.workspaceId,
      receiptCaptureId: input.receiptCaptureId,
      position: input.position,
      rawDescription: raw,
      normalizedDescription: input.normalizedDescription ?? null,
      quantity: input.quantity ?? null,
      unitOfMeasure: input.unitOfMeasure ?? null,
      unitPriceInCents: input.unitPriceInCents ?? null,
      lineTotalInCents: input.lineTotalInCents ?? null,
      selectedSubcategoryId: null,
      isIgnored: false,
      needsReview: input.needsReview ?? input.lineTotalInCents == null,
      warnings: input.warnings ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ReceiptItemProps): ReceiptItem {
    return new ReceiptItem(props);
  }

  get id(): string {
    return this.props.id;
  }
  get workspaceId(): string {
    return this.props.workspaceId;
  }
  get receiptCaptureId(): string {
    return this.props.receiptCaptureId;
  }
  get position(): number {
    return this.props.position;
  }
  get rawDescription(): string {
    return this.props.rawDescription;
  }
  get lineTotalInCents(): bigint | null {
    return this.props.lineTotalInCents;
  }
  get selectedSubcategoryId(): string | null {
    return this.props.selectedSubcategoryId;
  }
  get isIgnored(): boolean {
    return this.props.isIgnored;
  }
  get needsReview(): boolean {
    return this.props.needsReview;
  }

  toProps(): ReceiptItemProps {
    return { ...this.props, warnings: [...this.props.warnings] };
  }

  assignSubcategory(subcategoryId: string, now: Date = new Date()): void {
    this.props = {
      ...this.props,
      selectedSubcategoryId: subcategoryId,
      isIgnored: false,
      needsReview: this.props.lineTotalInCents == null,
      updatedAt: now,
    };
  }

  clearSubcategory(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      selectedSubcategoryId: null,
      updatedAt: now,
    };
  }

  ignore(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      isIgnored: true,
      needsReview: false,
      updatedAt: now,
    };
  }

  unignore(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      isIgnored: false,
      needsReview: this.props.lineTotalInCents == null || !this.props.selectedSubcategoryId,
      updatedAt: now,
    };
  }

  update(input: {
    rawDescription?: string;
    normalizedDescription?: string | null;
    quantity?: string | null;
    unitOfMeasure?: string | null;
    unitPriceInCents?: bigint | null;
    lineTotalInCents?: bigint | null;
    selectedSubcategoryId?: string | null;
    isIgnored?: boolean;
    needsReview?: boolean;
    now?: Date;
  }): void {
    const now = input.now ?? new Date();
    if (
      input.lineTotalInCents !== undefined &&
      input.lineTotalInCents !== null &&
      input.lineTotalInCents <= 0n
    ) {
      throw new DomainError('RECEIPT_ITEM_INVALID', 'O valor do item deve ser maior que zero.');
    }
    const rawDescription =
      input.rawDescription !== undefined ? input.rawDescription.trim() : this.props.rawDescription;
    if (!rawDescription) {
      throw new DomainError('RECEIPT_ITEM_INVALID', 'A descrição do item é obrigatória.');
    }

    const lineTotalInCents =
      input.lineTotalInCents !== undefined ? input.lineTotalInCents : this.props.lineTotalInCents;
    const selectedSubcategoryId =
      input.selectedSubcategoryId !== undefined
        ? input.selectedSubcategoryId
        : this.props.selectedSubcategoryId;
    const isIgnored = input.isIgnored !== undefined ? input.isIgnored : this.props.isIgnored;

    this.props = {
      ...this.props,
      rawDescription,
      normalizedDescription:
        input.normalizedDescription !== undefined
          ? input.normalizedDescription
          : this.props.normalizedDescription,
      quantity: input.quantity !== undefined ? input.quantity : this.props.quantity,
      unitOfMeasure:
        input.unitOfMeasure !== undefined ? input.unitOfMeasure : this.props.unitOfMeasure,
      unitPriceInCents:
        input.unitPriceInCents !== undefined ? input.unitPriceInCents : this.props.unitPriceInCents,
      lineTotalInCents,
      selectedSubcategoryId,
      isIgnored,
      needsReview:
        input.needsReview !== undefined
          ? input.needsReview
          : !isIgnored && (lineTotalInCents == null || !selectedSubcategoryId),
      updatedAt: now,
    };
  }

  isReadyForConfirmation(): boolean {
    if (this.props.isIgnored) return true;
    return (
      this.props.selectedSubcategoryId != null &&
      this.props.lineTotalInCents != null &&
      this.props.lineTotalInCents > 0n
    );
  }
}
