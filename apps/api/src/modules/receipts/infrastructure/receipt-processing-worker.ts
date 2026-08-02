import { hostname } from 'node:os';
import type { Env } from '@pp-planning/config/env';
import type { PrismaClient } from '@pp-planning/database';
import {
  ApplyExtractionResult,
  createReceiptExtractor,
  DomainError,
  validateExtractionResult,
} from '@pp-planning/domain';
import { PrismaReceiptCaptureRepository } from './prisma-receipt-capture-repository.js';
import { PrismaReceiptImageRepository } from './prisma-receipt-image-repository.js';
import { PrismaReceiptItemRepository } from './prisma-receipt-item-repository.js';
import { PrismaReceiptProcessingJobRepository } from './prisma-receipt-processing-job-repository.js';

const RETRY_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;

export class ReceiptProcessingWorker {
  private readonly workerId: string;
  private readonly captureRepo: PrismaReceiptCaptureRepository;
  private readonly imageRepo: PrismaReceiptImageRepository;
  private readonly itemRepo: PrismaReceiptItemRepository;
  private readonly jobRepo: PrismaReceiptProcessingJobRepository;
  private readonly applyExtraction: ApplyExtractionResult;
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: Env,
  ) {
    this.workerId = `${hostname()}-${process.pid}`;
    this.captureRepo = new PrismaReceiptCaptureRepository(prisma);
    this.imageRepo = new PrismaReceiptImageRepository(prisma);
    this.itemRepo = new PrismaReceiptItemRepository(prisma);
    this.jobRepo = new PrismaReceiptProcessingJobRepository(prisma);
    this.applyExtraction = new ApplyExtractionResult(this.captureRepo, this.itemRepo);
  }

  async processOnce(): Promise<boolean> {
    const now = new Date();
    const job = await this.jobRepo.claimNext(this.workerId, now);
    if (!job) return false;

    try {
      const capture = await this.captureRepo.findById(job.receiptCaptureId, job.workspaceId);
      if (!capture) {
        await this.jobRepo.markFailedOrRetry(job, {
          errorCode: 'RECEIPT_CAPTURE_NOT_FOUND',
          maxAttempts: this.env.RECEIPT_PROCESSING_MAX_ATTEMPTS,
          now,
          retryDelayMs: RETRY_DELAY_MS,
        });
        return true;
      }

      const images = await this.imageRepo.listByCapture(job.receiptCaptureId, job.workspaceId);
      const completedImages = images.filter((img) => img.uploadCompletedAt != null);
      if (completedImages.length === 0) {
        throw new DomainError('RECEIPT_IMAGE_REQUIRED', 'Nenhuma imagem concluída para processar.');
      }

      const extractor = createReceiptExtractor(job.provider);
      const rawResult = await extractor.extract({
        captureId: job.receiptCaptureId,
        workspaceId: job.workspaceId,
        imageStorageKeys: completedImages.map((img) => img.storageKey),
        mimeTypes: completedImages.map((img) => img.mimeType),
        fakeScenario:
          (capture.fakeScenario as
            | 'success'
            | 'missing-item-value'
            | 'total-mismatch'
            | 'processing-failure'
            | 'long-receipt'
            | undefined) ?? undefined,
      });

      const result = validateExtractionResult(rawResult);

      await this.applyExtraction.execute({
        captureId: job.receiptCaptureId,
        workspaceId: job.workspaceId,
        result,
        extractionVersion: 'fake-v1',
      });

      await this.jobRepo.markCompleted(job.id, new Date());
      return true;
    } catch (error) {
      const now = new Date();
      const errorCode = error instanceof DomainError ? error.code : 'RECEIPT_PROCESSING_FAILED';

      await this.jobRepo.markFailedOrRetry(job, {
        errorCode,
        maxAttempts: this.env.RECEIPT_PROCESSING_MAX_ATTEMPTS,
        now,
        retryDelayMs: RETRY_DELAY_MS,
      });

      return true;
    }
  }

  async startPolling(): Promise<void> {
    this.running = true;
    while (this.running) {
      const processed = await this.processOnce();
      if (!processed) {
        await sleep(POLL_INTERVAL_MS);
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runReceiptWorkerOnce(prisma: PrismaClient, env: Env): Promise<boolean> {
  const worker = new ReceiptProcessingWorker(prisma, env);
  return worker.processOnce();
}
