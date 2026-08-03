import type { ReceiptCapture } from './receipt-capture.js';
import type { ReceiptItem } from './receipt-item.js';

export type ReceiptImageRecord = {
  id: string;
  workspaceId: string;
  receiptCaptureId: string;
  storageKey: string;
  position: number;
  mimeType: string;
  sizeInBytes: number;
  width: number | null;
  height: number | null;
  uploadCompletedAt: Date | null;
  createdAt: Date;
};

export type ReceiptProcessingJobRecord = {
  id: string;
  workspaceId: string;
  receiptCaptureId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retryScheduled';
  attempts: number;
  provider: string;
  startedAt: Date | null;
  completedAt: Date | null;
  nextRetryAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface ReceiptCaptureRepository {
  findById(id: string, workspaceId: string): Promise<ReceiptCapture | null>;
  save(capture: ReceiptCapture): Promise<void>;
  listByWorkspace(
    workspaceId: string,
    filters: {
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: ReceiptCapture[]; totalItems: number }>;
}

export interface ReceiptItemRepository {
  listByCapture(captureId: string, workspaceId: string): Promise<ReceiptItem[]>;
  findById(id: string, workspaceId: string): Promise<ReceiptItem | null>;
  save(item: ReceiptItem): Promise<void>;
  saveMany(items: ReceiptItem[]): Promise<void>;
  replaceCaptureItems(captureId: string, workspaceId: string, items: ReceiptItem[]): Promise<void>;
}

export interface ReceiptImageRepository {
  listByCapture(captureId: string, workspaceId: string): Promise<ReceiptImageRecord[]>;
  findById(id: string, workspaceId: string): Promise<ReceiptImageRecord | null>;
  save(image: ReceiptImageRecord): Promise<void>;
  countByCapture(captureId: string, workspaceId: string): Promise<number>;
}

export interface ReceiptProcessingJobRepository {
  save(job: ReceiptProcessingJobRecord): Promise<void>;
  findById(id: string): Promise<ReceiptProcessingJobRecord | null>;
  claimNext(lockedBy: string, now: Date): Promise<ReceiptProcessingJobRecord | null>;
  markCompleted(id: string, now: Date): Promise<void>;
  markFailedOrRetry(
    job: ReceiptProcessingJobRecord,
    input: { errorCode: string; maxAttempts: number; now: Date; retryDelayMs: number },
  ): Promise<void>;
}

export type ConfirmedLedgerDraft = {
  id: string;
  subcategoryId: string;
  categoryId: string;
  description: string;
  amountInCents: bigint;
  occurredOn: string;
  competenceYear: number;
  competenceMonth: number;
  attributedMemberId?: string;
};

export interface ReceiptConfirmationStore {
  confirmAtomic(input: {
    capture: ReceiptCapture;
    items: ReceiptItem[];
    ledgerDrafts: ConfirmedLedgerDraft[];
    confirmedByUserId: string;
  }): Promise<{ ledgerEntryIds: string[] }>;
}
