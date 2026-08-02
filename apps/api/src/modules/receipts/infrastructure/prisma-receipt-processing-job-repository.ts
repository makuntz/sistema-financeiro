import type { PrismaClient } from '@pp-planning/database';
import type {
  ReceiptProcessingJobRecord,
  ReceiptProcessingJobRepository,
} from '@pp-planning/domain';

const LOCK_EXPIRY_MS = 5 * 60 * 1000;

type JobRow = {
  id: string;
  workspaceId: string;
  receiptCaptureId: string;
  status: string;
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

export class PrismaReceiptProcessingJobRepository implements ReceiptProcessingJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(job: ReceiptProcessingJobRecord): Promise<void> {
    await this.prisma.receiptProcessingJob.upsert({
      where: { id: job.id },
      create: {
        id: job.id,
        workspaceId: job.workspaceId,
        receiptCaptureId: job.receiptCaptureId,
        status: job.status,
        attempts: job.attempts,
        provider: job.provider,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        nextRetryAt: job.nextRetryAt,
        lockedAt: job.lockedAt,
        lockedBy: job.lockedBy,
        errorCode: job.errorCode,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      update: {
        status: job.status,
        attempts: job.attempts,
        provider: job.provider,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        nextRetryAt: job.nextRetryAt,
        lockedAt: job.lockedAt,
        lockedBy: job.lockedBy,
        errorCode: job.errorCode,
        updatedAt: job.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ReceiptProcessingJobRecord | null> {
    const row = await this.prisma.receiptProcessingJob.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async claimNext(lockedBy: string, now: Date): Promise<ReceiptProcessingJobRecord | null> {
    const lockExpiredBefore = new Date(now.getTime() - LOCK_EXPIRY_MS);

    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<JobRow[]>`
        SELECT *
        FROM receipt_processing_jobs
        WHERE status IN ('pending', 'retryScheduled')
          AND (next_retry_at IS NULL OR next_retry_at <= ${now})
          AND (locked_at IS NULL OR locked_at < ${lockExpiredBefore})
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      const candidate = candidates[0];
      if (!candidate) return null;

      const updated = await tx.receiptProcessingJob.update({
        where: { id: candidate.id },
        data: {
          status: 'processing',
          lockedAt: now,
          lockedBy,
          attempts: { increment: 1 },
          startedAt: now,
          updatedAt: now,
        },
      });

      return this.toRecord(updated);
    });
  }

  async markCompleted(id: string, now: Date): Promise<void> {
    await this.prisma.receiptProcessingJob.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      },
    });
  }

  async markFailedOrRetry(
    job: ReceiptProcessingJobRecord,
    input: { errorCode: string; maxAttempts: number; now: Date; retryDelayMs: number },
  ): Promise<void> {
    const reachedMax = job.attempts >= input.maxAttempts;
    const nextRetryAt = reachedMax ? null : new Date(input.now.getTime() + input.retryDelayMs);

    await this.prisma.receiptProcessingJob.update({
      where: { id: job.id },
      data: {
        status: reachedMax ? 'failed' : 'retryScheduled',
        errorCode: input.errorCode,
        nextRetryAt,
        lockedAt: null,
        lockedBy: null,
        completedAt: reachedMax ? input.now : null,
        updatedAt: input.now,
      },
    });

    if (reachedMax) {
      await this.prisma.receiptCapture.updateMany({
        where: {
          id: job.receiptCaptureId,
          workspaceId: job.workspaceId,
          status: 'processing',
        },
        data: {
          status: 'failed',
          failureCode: input.errorCode,
          failureMessage: 'Falha no processamento da nota após múltiplas tentativas.',
          processingCompletedAt: input.now,
          updatedAt: input.now,
        },
      });
    }
  }

  private toRecord(row: JobRow): ReceiptProcessingJobRecord {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      receiptCaptureId: row.receiptCaptureId,
      status: row.status as ReceiptProcessingJobRecord['status'],
      attempts: row.attempts,
      provider: row.provider,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      nextRetryAt: row.nextRetryAt,
      lockedAt: row.lockedAt,
      lockedBy: row.lockedBy,
      errorCode: row.errorCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
