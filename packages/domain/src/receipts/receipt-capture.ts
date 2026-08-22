import { DomainError } from '../shared/domain-error.js';

export type ReceiptCaptureStatus =
  'draft' | 'uploaded' | 'processing' | 'review' | 'confirmed' | 'failed' | 'canceled';

const ALLOWED: Record<ReceiptCaptureStatus, readonly ReceiptCaptureStatus[]> = {
  draft: ['uploaded', 'processing'],
  uploaded: ['processing'],
  processing: ['review', 'failed'],
  review: ['processing', 'confirmed', 'canceled'],
  failed: ['processing', 'canceled'],
  confirmed: [],
  canceled: [],
};

export type ReceiptCaptureProps = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  status: ReceiptCaptureStatus;
  merchantName: string | null;
  purchaseDate: string | null;
  totalAmountInCents: bigint | null;
  defaultCategoryId: string | null;
  extractionProvider: string;
  extractionVersion: string | null;
  fakeScenario: string | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function assertTransition(from: ReceiptCaptureStatus, to: ReceiptCaptureStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new DomainError(
      'RECEIPT_CAPTURE_INVALID_STATUS',
      `Transição inválida de ${from} para ${to}.`,
      { from, to },
    );
  }
}

export class ReceiptCapture {
  private constructor(private props: ReceiptCaptureProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    createdByUserId: string;
    defaultCategoryId?: string | null;
    extractionProvider?: string;
    fakeScenario?: string | null;
    now?: Date;
  }): ReceiptCapture {
    const now = input.now ?? new Date();
    return new ReceiptCapture({
      id: input.id,
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      status: 'draft',
      merchantName: null,
      purchaseDate: null,
      totalAmountInCents: null,
      defaultCategoryId: input.defaultCategoryId ?? null,
      extractionProvider: input.extractionProvider ?? 'fake',
      extractionVersion: null,
      fakeScenario: input.fakeScenario ?? null,
      processingStartedAt: null,
      processingCompletedAt: null,
      confirmedAt: null,
      confirmedByUserId: null,
      failureCode: null,
      failureMessage: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ReceiptCaptureProps): ReceiptCapture {
    return new ReceiptCapture(props);
  }

  get id(): string {
    return this.props.id;
  }
  get workspaceId(): string {
    return this.props.workspaceId;
  }
  get status(): ReceiptCaptureStatus {
    return this.props.status;
  }
  get merchantName(): string | null {
    return this.props.merchantName;
  }
  get purchaseDate(): string | null {
    return this.props.purchaseDate;
  }
  get totalAmountInCents(): bigint | null {
    return this.props.totalAmountInCents;
  }
  get defaultCategoryId(): string | null {
    return this.props.defaultCategoryId;
  }
  get extractionProvider(): string {
    return this.props.extractionProvider;
  }
  get fakeScenario(): string | null {
    return this.props.fakeScenario;
  }
  get confirmedAt(): Date | null {
    return this.props.confirmedAt;
  }

  toProps(): ReceiptCaptureProps {
    return { ...this.props };
  }

  private transition(to: ReceiptCaptureStatus, now: Date): void {
    assertTransition(this.props.status, to);
    this.props = { ...this.props, status: to, updatedAt: now };
  }

  markUploaded(now: Date = new Date()): void {
    this.transition('uploaded', now);
  }

  startProcessing(now: Date = new Date()): void {
    this.transition('processing', now);
    this.props = {
      ...this.props,
      processingStartedAt: now,
      failureCode: null,
      failureMessage: null,
      updatedAt: now,
    };
  }

  prepareForOcrExtraction(now: Date = new Date()): void {
    if (this.props.status !== 'draft' && this.props.status !== 'failed') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Somente capturas em rascunho ou com falha podem receber OCR.',
        { status: this.props.status },
      );
    }
    this.startProcessing(now);
  }

  markReview(
    input: {
      merchantName: string | null;
      purchaseDate: string | null;
      totalAmountInCents: bigint | null;
      extractionVersion?: string | null;
      extractionProvider?: string | null;
    },
    now: Date = new Date(),
  ): void {
    this.transition('review', now);
    this.props = {
      ...this.props,
      merchantName: input.merchantName,
      purchaseDate: input.purchaseDate,
      totalAmountInCents: input.totalAmountInCents,
      extractionVersion: input.extractionVersion ?? this.props.extractionVersion,
      extractionProvider: input.extractionProvider ?? this.props.extractionProvider,
      processingCompletedAt: now,
      updatedAt: now,
    };
  }

  markFailed(code: string, message: string, now: Date = new Date()): void {
    this.transition('failed', now);
    this.props = {
      ...this.props,
      failureCode: code,
      failureMessage: message,
      processingCompletedAt: now,
      updatedAt: now,
    };
  }

  confirm(userId: string, now: Date = new Date()): void {
    if (this.props.status === 'confirmed') {
      throw new DomainError(
        'RECEIPT_CAPTURE_ALREADY_CONFIRMED',
        'Esta captura já foi confirmada.',
        { captureId: this.props.id },
      );
    }
    this.transition('confirmed', now);
    this.props = {
      ...this.props,
      confirmedAt: now,
      confirmedByUserId: userId,
      updatedAt: now,
    };
  }

  cancel(now: Date = new Date()): void {
    this.transition('canceled', now);
  }

  updateReviewFields(input: {
    merchantName?: string | null;
    purchaseDate?: string | null;
    totalAmountInCents?: bigint | null;
    defaultCategoryId?: string | null;
    now?: Date;
  }): void {
    if (this.props.status !== 'review' && this.props.status !== 'draft') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Só é possível editar capturas em revisão ou rascunho.',
        { status: this.props.status },
      );
    }
    const now = input.now ?? new Date();
    this.props = {
      ...this.props,
      merchantName: input.merchantName !== undefined ? input.merchantName : this.props.merchantName,
      purchaseDate: input.purchaseDate !== undefined ? input.purchaseDate : this.props.purchaseDate,
      totalAmountInCents:
        input.totalAmountInCents !== undefined
          ? input.totalAmountInCents
          : this.props.totalAmountInCents,
      defaultCategoryId:
        input.defaultCategoryId !== undefined
          ? input.defaultCategoryId
          : this.props.defaultCategoryId,
      updatedAt: now,
    };
  }
}
