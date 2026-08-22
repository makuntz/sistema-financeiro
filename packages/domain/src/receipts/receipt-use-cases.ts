import { randomUUID } from 'node:crypto';
import type { ReceiptExtractionResult } from '@pp-planning/contracts';
import { DomainError } from '../shared/domain-error.js';
import { normalizeExtractedMoneyInCents } from './receipt-extractor.js';
import { ReceiptCapture } from './receipt-capture.js';
import { ReceiptItem } from './receipt-item.js';
import type {
  ReceiptCaptureRepository,
  ReceiptImageRecord,
  ReceiptImageRepository,
  ReceiptItemRepository,
  ReceiptProcessingJobRecord,
  ReceiptProcessingJobRepository,
} from './repositories.js';

export type ReceiptUploadUrlPort = {
  createUploadUrl(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: Date; headers: Record<string, string> }>;
  exists(key: string): Promise<boolean>;
  getObjectMetadata(key: string): Promise<{ sizeInBytes: number; mimeType?: string } | null>;
};

export type ReceiptImageLimits = {
  maxSizeBytes: number;
  maxCount: number;
};

function buildStorageKey(
  workspaceId: string,
  captureId: string,
  imageId: string,
  mimeType: string,
): string {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return `workspaces/${workspaceId}/receipts/${captureId}/${imageId}.${ext}`;
}

export class CreateReceiptCapture {
  constructor(private readonly captures: ReceiptCaptureRepository) {}

  async execute(input: {
    id: string;
    workspaceId: string;
    userId: string;
    defaultCategoryId?: string | null;
    fakeScenario?: string | null;
    extractionProvider?: string;
  }): Promise<ReceiptCapture> {
    const capture = ReceiptCapture.create({
      id: input.id,
      workspaceId: input.workspaceId,
      createdByUserId: input.userId,
      defaultCategoryId: input.defaultCategoryId,
      fakeScenario: input.fakeScenario,
      extractionProvider: input.extractionProvider,
    });
    await this.captures.save(capture);
    return capture;
  }
}

export class RequestReceiptImageUploadUrl {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly images: ReceiptImageRepository,
    private readonly storage: ReceiptUploadUrlPort,
    private readonly limits: ReceiptImageLimits,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    imageId: string;
    mimeType: string;
    sizeInBytes: number;
    uploadExpiresInSeconds?: number;
  }): Promise<{
    imageId: string;
    uploadUrl: string;
    expiresAt: Date;
    headers: Record<string, string>;
  }> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }
    if (capture.status !== 'draft' && capture.status !== 'uploaded') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Só é possível enviar imagens em rascunho ou após upload parcial.',
        { status: capture.status },
      );
    }

    if (input.sizeInBytes > this.limits.maxSizeBytes) {
      throw new DomainError(
        'RECEIPT_IMAGE_TOO_LARGE',
        'A imagem excede o tamanho máximo permitido.',
      );
    }

    const count = await this.images.countByCapture(input.captureId, input.workspaceId);
    if (count >= this.limits.maxCount) {
      throw new DomainError(
        'RECEIPT_IMAGE_LIMIT_EXCEEDED',
        'Limite de imagens por captura atingido.',
      );
    }

    const position = count + 1;
    const storageKey = buildStorageKey(
      input.workspaceId,
      input.captureId,
      input.imageId,
      input.mimeType,
    );
    const now = new Date();

    const image: ReceiptImageRecord = {
      id: input.imageId,
      workspaceId: input.workspaceId,
      receiptCaptureId: input.captureId,
      storageKey,
      position,
      mimeType: input.mimeType,
      sizeInBytes: input.sizeInBytes,
      width: null,
      height: null,
      uploadCompletedAt: null,
      createdAt: now,
    };
    await this.images.save(image);

    const expiresInSeconds = input.uploadExpiresInSeconds ?? 900;
    const upload = await this.storage.createUploadUrl({
      key: storageKey,
      mimeType: input.mimeType,
      expiresInSeconds,
    });

    return {
      imageId: input.imageId,
      uploadUrl: upload.url,
      expiresAt: upload.expiresAt,
      headers: upload.headers,
    };
  }
}

export class CompleteReceiptImageUpload {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly images: ReceiptImageRepository,
    private readonly storage: ReceiptUploadUrlPort,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    imageId: string;
  }): Promise<ReceiptImageRecord> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }

    const image = await this.images.findById(input.imageId, input.workspaceId);
    if (!image || image.receiptCaptureId !== input.captureId) {
      throw new DomainError('RECEIPT_IMAGE_NOT_FOUND', 'Imagem não encontrada.');
    }

    if (image.uploadCompletedAt) {
      return image;
    }

    const exists = await this.storage.exists(image.storageKey);
    if (!exists) {
      throw new DomainError(
        'RECEIPT_IMAGE_UPLOAD_INCOMPLETE',
        'Upload da imagem ainda não foi concluído no storage.',
      );
    }

    const metadata = await this.storage.getObjectMetadata(image.storageKey);
    if (!metadata || metadata.sizeInBytes <= 0) {
      throw new DomainError(
        'RECEIPT_IMAGE_UPLOAD_INCOMPLETE',
        'Upload da imagem ainda não foi concluído no storage.',
      );
    }

    const now = new Date();
    const completed: ReceiptImageRecord = {
      ...image,
      sizeInBytes: metadata.sizeInBytes,
      uploadCompletedAt: now,
    };
    await this.images.save(completed);

    if (capture.status === 'draft') {
      capture.markUploaded(now);
      await this.captures.save(capture);
    }

    return completed;
  }
}

export class ProcessReceiptCapture {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly images: ReceiptImageRepository,
    private readonly jobs: ReceiptProcessingJobRepository,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    provider: string;
    jobId?: string;
  }): Promise<{ capture: ReceiptCapture; job: ReceiptProcessingJobRecord }> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }

    if (capture.status === 'processing') {
      throw new DomainError(
        'RECEIPT_PROCESSING_IN_PROGRESS',
        'Esta captura já está em processamento.',
      );
    }

    if (
      capture.status !== 'uploaded' &&
      capture.status !== 'failed' &&
      capture.status !== 'review'
    ) {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Somente capturas enviadas podem ser processadas.',
        { status: capture.status },
      );
    }

    const images = await this.images.listByCapture(input.captureId, input.workspaceId);
    const completed = images.filter((img) => img.uploadCompletedAt != null);
    if (completed.length === 0) {
      throw new DomainError(
        'RECEIPT_IMAGE_REQUIRED',
        'Envie ao menos uma imagem antes de processar.',
      );
    }

    const now = new Date();
    capture.startProcessing(now);
    await this.captures.save(capture);

    const job: ReceiptProcessingJobRecord = {
      id: input.jobId ?? randomUUID(),
      workspaceId: input.workspaceId,
      receiptCaptureId: input.captureId,
      status: 'pending',
      attempts: 0,
      provider: input.provider,
      startedAt: null,
      completedAt: null,
      nextRetryAt: null,
      lockedAt: null,
      lockedBy: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.jobs.save(job);

    return { capture, job };
  }
}

export class ApplyExtractionResult {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly items: ReceiptItemRepository,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    result: ReceiptExtractionResult;
    extractionVersion?: string | null;
    extractionProvider?: string | null;
  }): Promise<{ capture: ReceiptCapture; items: ReceiptItem[] }> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }

    const now = new Date();
    const domainItems = input.result.items.map((item) => {
      const lineTotalInCents = normalizeExtractedMoneyInCents(item.lineTotalInCents);
      const unitPriceInCents = normalizeExtractedMoneyInCents(item.unitPriceInCents);
      const warnings = [...item.warnings];
      let needsReview = item.needsReview;

      if (item.lineTotalInCents != null && lineTotalInCents == null) {
        needsReview = true;
        if (!warnings.includes('Valor não identificado.')) {
          warnings.push('Valor não identificado.');
        }
      }

      return ReceiptItem.create({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        receiptCaptureId: input.captureId,
        position: item.position,
        rawDescription: item.rawDescription,
        normalizedDescription: item.normalizedDescription ?? null,
        quantity: item.quantity ?? null,
        unitOfMeasure: item.unitOfMeasure ?? null,
        unitPriceInCents: unitPriceInCents != null ? BigInt(unitPriceInCents) : null,
        lineTotalInCents: lineTotalInCents != null ? BigInt(lineTotalInCents) : null,
        needsReview,
        warnings,
        now,
      });
    });

    await this.items.replaceCaptureItems(input.captureId, input.workspaceId, domainItems);

    capture.markReview(
      {
        merchantName: input.result.merchantName ?? null,
        purchaseDate: input.result.purchaseDate ?? null,
        totalAmountInCents:
          input.result.totalAmountInCents != null ? BigInt(input.result.totalAmountInCents) : null,
        extractionVersion: input.extractionVersion ?? null,
        extractionProvider: input.extractionProvider ?? null,
      },
      now,
    );
    await this.captures.save(capture);

    return { capture, items: domainItems };
  }
}

export class UpdateReceiptCapture {
  constructor(private readonly captures: ReceiptCaptureRepository) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    merchantName?: string | null;
    purchaseDate?: string | null;
    totalAmountInCents?: bigint | null;
    defaultCategoryId?: string | null;
  }): Promise<ReceiptCapture> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }

    capture.updateReviewFields({
      merchantName: input.merchantName,
      purchaseDate: input.purchaseDate,
      totalAmountInCents: input.totalAmountInCents,
      defaultCategoryId: input.defaultCategoryId,
    });
    await this.captures.save(capture);
    return capture;
  }
}

export class UpdateReceiptItem {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly items: ReceiptItemRepository,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    itemId: string;
    rawDescription?: string;
    normalizedDescription?: string | null;
    quantity?: string | null;
    unitOfMeasure?: string | null;
    unitPriceInCents?: bigint | null;
    lineTotalInCents?: bigint | null;
    selectedSubcategoryId?: string | null;
    isIgnored?: boolean;
    needsReview?: boolean;
  }): Promise<ReceiptItem> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }
    if (capture.status !== 'review') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Só é possível editar itens em revisão.',
      );
    }

    const item = await this.items.findById(input.itemId, input.workspaceId);
    if (!item || item.receiptCaptureId !== input.captureId) {
      throw new DomainError('RECEIPT_ITEM_NOT_FOUND', 'Item não encontrado.');
    }

    item.update({
      rawDescription: input.rawDescription,
      normalizedDescription: input.normalizedDescription,
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
      unitPriceInCents: input.unitPriceInCents,
      lineTotalInCents: input.lineTotalInCents,
      selectedSubcategoryId: input.selectedSubcategoryId,
      isIgnored: input.isIgnored,
      needsReview: input.needsReview,
    });
    await this.items.save(item);
    return item;
  }
}

export class ReprocessReceiptCapture {
  constructor(private readonly process: ProcessReceiptCapture) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    provider: string;
    jobId?: string;
  }): Promise<{ capture: ReceiptCapture; job: ReceiptProcessingJobRecord }> {
    return this.process.execute(input);
  }
}

export class GetReceiptCapture {
  constructor(private readonly captures: ReceiptCaptureRepository) {}

  async execute(input: { captureId: string; workspaceId: string }): Promise<ReceiptCapture> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }
    return capture;
  }
}
