import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createReceiptCaptureRequestSchema,
  createReceiptUploadUrlRequestSchema,
  createReceiptUploadUrlResponseSchema,
  completeReceiptImageUploadRequestSchema,
  updateReceiptCaptureRequestSchema,
  updateReceiptItemRequestSchema,
  bulkAssignReceiptItemsRequestSchema,
  bulkIgnoreReceiptItemsRequestSchema,
  confirmReceiptCaptureRequestSchema,
  receiptCaptureListQuerySchema,
  receiptCaptureDtoSchema,
  receiptConfirmationResultDtoSchema,
  type ReceiptCaptureDto,
  type CreateReceiptUploadUrlResponse,
  type ReceiptConfirmationResultDto,
} from '@pp-planning/contracts';
import {
  CreateReceiptCapture,
  RequestReceiptImageUploadUrl,
  CompleteReceiptImageUpload,
  ProcessReceiptCapture,
  UpdateReceiptCapture,
  UpdateReceiptItem,
  ReprocessReceiptCapture,
  ConfirmReceiptCapture,
  BulkAssignReceiptItems,
  BulkIgnoreReceiptItems,
  DomainError,
  type ReceiptCaptureRepository,
  type ReceiptImageRepository,
  type ReceiptItemRepository,
  type ReceiptProcessingJobRepository,
  type ReceiptConfirmationStore,
  type ReceiptSubcategoryLookup,
  type AuditLogger,
  type Permission,
} from '@pp-planning/domain';
import type { Env } from '@pp-planning/config/env';
import type { FileStorage } from '../../../../infrastructure/storage/file-storage.js';
import type {
  PrismaReceiptEnrichment,
  EnrichedReceiptCapture,
} from '../../infrastructure/prisma-receipt-enrichment.js';

const captureParamsSchema = z.object({ captureId: z.string().uuid() });
const imageParamsSchema = captureParamsSchema.extend({ imageId: z.string().uuid() });
const itemParamsSchema = captureParamsSchema.extend({ itemId: z.string().uuid() });

const DOWNLOAD_URL_EXPIRES_SECONDS = 900;

export type ReceiptHttpDeps = {
  env: Env;
  fileStorage: FileStorage;
  captureRepository: ReceiptCaptureRepository;
  imageRepository: ReceiptImageRepository;
  itemRepository: ReceiptItemRepository;
  jobRepository: ReceiptProcessingJobRepository;
  confirmationStore: ReceiptConfirmationStore;
  subcategoryLookup: ReceiptSubcategoryLookup;
  enrichment: PrismaReceiptEnrichment;
  auditLogger: AuditLogger;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (
    permission: Permission,
  ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

async function toDto(
  enriched: EnrichedReceiptCapture,
  fileStorage: FileStorage,
): Promise<ReceiptCaptureDto> {
  const props = enriched.capture.toProps();
  const images = await Promise.all(
    enriched.images.map(async (img) => {
      let downloadUrl: string | null = null;
      let downloadUrlExpiresAt: string | null = null;
      if (img.uploadCompletedAt) {
        const signed = await fileStorage.createDownloadUrl({
          key: img.storageKey,
          expiresInSeconds: DOWNLOAD_URL_EXPIRES_SECONDS,
        });
        downloadUrl = signed.url;
        downloadUrlExpiresAt = signed.expiresAt.toISOString();
      }
      return {
        id: img.id,
        position: img.position,
        mimeType: img.mimeType,
        sizeInBytes: img.sizeInBytes,
        width: img.width,
        height: img.height,
        downloadUrl,
        downloadUrlExpiresAt,
        createdAt: img.createdAt.toISOString(),
      };
    }),
  );

  return {
    id: props.id,
    workspaceId: props.workspaceId,
    status: props.status,
    merchantName: props.merchantName,
    purchaseDate: props.purchaseDate,
    totalAmountInCents: props.totalAmountInCents?.toString() ?? null,
    defaultCategoryId: props.defaultCategoryId,
    defaultCategoryName: enriched.defaultCategoryName,
    extractionProvider: props.extractionProvider as 'fake',
    extractionVersion: props.extractionVersion,
    processingStartedAt: props.processingStartedAt?.toISOString() ?? null,
    processingCompletedAt: props.processingCompletedAt?.toISOString() ?? null,
    confirmedAt: props.confirmedAt?.toISOString() ?? null,
    confirmedByUserId: props.confirmedByUserId,
    failureCode: props.failureCode,
    failureMessage: props.failureMessage,
    createdByUserId: props.createdByUserId,
    images,
    items: enriched.items.map(
      ({ item, selectedSubcategoryName, selectedCategoryId, selectedCategoryName }) => {
        const itemProps = item.toProps();
        return {
          id: itemProps.id,
          position: itemProps.position,
          rawDescription: itemProps.rawDescription,
          normalizedDescription: itemProps.normalizedDescription,
          quantity: itemProps.quantity,
          unitOfMeasure: itemProps.unitOfMeasure,
          unitPriceInCents: itemProps.unitPriceInCents?.toString() ?? null,
          lineTotalInCents: itemProps.lineTotalInCents?.toString() ?? null,
          selectedSubcategoryId: itemProps.selectedSubcategoryId,
          selectedSubcategoryName,
          selectedCategoryId,
          selectedCategoryName,
          isIgnored: itemProps.isIgnored,
          needsReview: itemProps.needsReview,
          warnings: itemProps.warnings,
          createdAt: itemProps.createdAt.toISOString(),
          updatedAt: itemProps.updatedAt.toISOString(),
        };
      },
    ),
    itemCount: enriched.itemCount,
    classifiedItemCount: enriched.classifiedItemCount,
    ignoredItemCount: enriched.ignoredItemCount,
    itemsTotalInCents: enriched.itemsTotalInCents.toString(),
    totalDifferenceInCents: (enriched.totalDifferenceInCents ?? 0n).toString(),
    ledgerEntryIds: enriched.ledgerEntryIds,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}

async function fetchEnrichedDto(
  deps: ReceiptHttpDeps,
  captureId: string,
  workspaceId: string,
): Promise<ReceiptCaptureDto> {
  const enriched = await deps.enrichment.findEnrichedById(captureId, workspaceId);
  if (!enriched) {
    throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
  }
  return toDto(enriched, deps.fileStorage);
}

export async function registerReceiptRoutes(
  app: FastifyInstance,
  deps: ReceiptHttpDeps,
): Promise<void> {
  for (const contentType of ['image/jpeg', 'image/png', 'application/octet-stream'] as const) {
    app.addContentTypeParser(
      contentType,
      { parseAs: 'buffer' },
      (_request, body, done) => {
        done(null, body);
      },
    );
  }

  const imageLimits = {
    maxSizeBytes: deps.env.RECEIPT_IMAGE_MAX_SIZE_BYTES,
    maxCount: deps.env.RECEIPT_IMAGE_MAX_COUNT,
  };

  const storagePort = {
    createUploadUrl: (input: { key: string; mimeType: string; expiresInSeconds: number }) =>
      deps.fileStorage.createUploadUrl(input),
    exists: (key: string) => deps.fileStorage.exists(key),
    getObjectMetadata: (key: string) => deps.fileStorage.getObjectMetadata(key),
  };

  const createReceiptCapture = new CreateReceiptCapture(deps.captureRepository);
  const requestUploadUrl = new RequestReceiptImageUploadUrl(
    deps.captureRepository,
    deps.imageRepository,
    storagePort,
    imageLimits,
  );
  const completeUpload = new CompleteReceiptImageUpload(
    deps.captureRepository,
    deps.imageRepository,
    storagePort,
  );
  const processCapture = new ProcessReceiptCapture(
    deps.captureRepository,
    deps.imageRepository,
    deps.jobRepository,
  );
  const reprocessCapture = new ReprocessReceiptCapture(processCapture);
  const updateCapture = new UpdateReceiptCapture(deps.captureRepository);
  const updateItem = new UpdateReceiptItem(deps.captureRepository, deps.itemRepository);
  const confirmCapture = new ConfirmReceiptCapture(
    deps.captureRepository,
    deps.itemRepository,
    deps.subcategoryLookup,
    deps.confirmationStore,
    deps.auditLogger,
  );
  const bulkAssign = new BulkAssignReceiptItems(
    deps.captureRepository,
    deps.itemRepository,
    deps.subcategoryLookup,
    deps.auditLogger,
  );
  const bulkIgnore = new BulkIgnoreReceiptItems(
    deps.captureRepository,
    deps.itemRepository,
    deps.auditLogger,
  );

  const readGuard = [
    deps.authenticate,
    deps.requireWorkspace,
    deps.requirePermission('ledger.read'),
  ];
  const writeGuard = [
    deps.authenticate,
    deps.requireWorkspace,
    deps.requirePermission('ledger.write'),
  ];

  app.post(
    '/v1/receipt-captures',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        body: createReceiptCaptureRequestSchema,
        response: { 201: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const body = createReceiptCaptureRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const userId = request.auth!.userId;
      const captureId = randomUUID();

      await createReceiptCapture.execute({
        id: captureId,
        workspaceId,
        userId,
        defaultCategoryId: body.defaultCategoryId,
        fakeScenario: body.fakeScenario,
        extractionProvider: deps.env.RECEIPT_EXTRACTOR_PROVIDER,
      });

      await deps.auditLogger.record({
        name: 'ReceiptCaptureCreated',
        actorUserId: userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId },
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.status(201).send(dto);
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/images/upload-url',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        body: createReceiptUploadUrlRequestSchema,
        response: { 201: createReceiptUploadUrlResponseSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const body = createReceiptUploadUrlRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const imageId = randomUUID();

      const result = await requestUploadUrl.execute({
        captureId,
        workspaceId,
        imageId,
        mimeType: body.mimeType,
        sizeInBytes: body.sizeInBytes,
      });

      await deps.auditLogger.record({
        name: 'ReceiptImageUploadRequested',
        actorUserId: request.auth!.userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId, imageId, mimeType: body.mimeType, sizeInBytes: body.sizeInBytes },
      });

      const response: CreateReceiptUploadUrlResponse = {
        imageId: result.imageId,
        uploadUrl: result.uploadUrl,
        expiresAt: result.expiresAt.toISOString(),
        headers: result.headers,
      };
      return reply.status(201).send(response);
    },
  );

  // Mobile/emulator-friendly upload: client sends bytes to the API, API writes to MinIO.
  // Avoids direct emulator → MinIO networking (localhost / cleartext / port 9000 issues).
  app.put(
    '/v1/receipt-captures/:captureId/images/:imageId/content',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: imageParamsSchema,
        hide: true,
      },
      bodyLimit: deps.env.RECEIPT_IMAGE_MAX_SIZE_BYTES,
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId, imageId } = imageParamsSchema.parse(request.params);
      const workspaceId = request.workspace!.workspaceId;
      const image = await deps.imageRepository.findById(imageId, workspaceId);
      if (!image || image.receiptCaptureId !== captureId) {
        throw new DomainError('RECEIPT_IMAGE_NOT_FOUND', 'Imagem não encontrada.');
      }

      const contentTypeHeader = request.headers['content-type'];
      const contentType =
        typeof contentTypeHeader === 'string'
          ? contentTypeHeader.split(';')[0]?.trim()
          : image.mimeType;
      if (contentType !== 'image/jpeg' && contentType !== 'image/png') {
        throw new DomainError('RECEIPT_IMAGE_INVALID', 'Tipo de imagem inválido.');
      }

      const body = request.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new DomainError('RECEIPT_IMAGE_INVALID', 'Corpo da imagem inválido.');
      }
      if (body.length > deps.env.RECEIPT_IMAGE_MAX_SIZE_BYTES) {
        throw new DomainError('RECEIPT_IMAGE_TOO_LARGE', 'A imagem excede o tamanho máximo.');
      }

      await deps.fileStorage.putObject({
        key: image.storageKey,
        body,
        mimeType: contentType,
      });

      await completeUpload.execute({ captureId, workspaceId, imageId });
      await deps.auditLogger.record({
        name: 'ReceiptImageUploaded',
        actorUserId: request.auth!.userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId, imageId, sizeInBytes: body.length },
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/images/:imageId/complete',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: imageParamsSchema,
        body: completeReceiptImageUploadRequestSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId, imageId } = imageParamsSchema.parse(request.params);
      completeReceiptImageUploadRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;

      await completeUpload.execute({ captureId, workspaceId, imageId });
      await deps.auditLogger.record({
        name: 'ReceiptImageUploaded',
        actorUserId: request.auth!.userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId, imageId },
      });
      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/process',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const workspaceId = request.workspace!.workspaceId;

      await processCapture.execute({
        captureId,
        workspaceId,
        provider: deps.env.RECEIPT_EXTRACTOR_PROVIDER,
        jobId: randomUUID(),
      });

      await deps.auditLogger.record({
        name: 'ReceiptProcessingStarted',
        actorUserId: request.auth!.userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId, provider: deps.env.RECEIPT_EXTRACTOR_PROVIDER },
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.get(
    '/v1/receipt-captures/:captureId',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: readGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const workspaceId = request.workspace!.workspaceId;
      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.patch(
    '/v1/receipt-captures/:captureId',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        body: updateReceiptCaptureRequestSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const body = updateReceiptCaptureRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;

      await updateCapture.execute({
        captureId,
        workspaceId,
        merchantName: body.merchantName,
        purchaseDate: body.purchaseDate,
        totalAmountInCents:
          body.totalAmountInCents != null
            ? BigInt(body.totalAmountInCents)
            : body.totalAmountInCents,
        defaultCategoryId: body.defaultCategoryId,
      });

      await deps.auditLogger.record({
        name: 'ReceiptCaptureUpdated',
        actorUserId: request.auth!.userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId },
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.patch(
    '/v1/receipt-captures/:captureId/items/:itemId',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: itemParamsSchema,
        body: updateReceiptItemRequestSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId, itemId } = itemParamsSchema.parse(request.params);
      const body = updateReceiptItemRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;

      await updateItem.execute({
        captureId,
        workspaceId,
        itemId,
        rawDescription: body.rawDescription,
        normalizedDescription: body.normalizedDescription,
        quantity: body.quantity,
        unitOfMeasure: body.unitOfMeasure,
        unitPriceInCents:
          body.unitPriceInCents != null ? BigInt(body.unitPriceInCents) : body.unitPriceInCents,
        lineTotalInCents:
          body.lineTotalInCents != null ? BigInt(body.lineTotalInCents) : body.lineTotalInCents,
        selectedSubcategoryId: body.selectedSubcategoryId,
        isIgnored: body.isIgnored,
        needsReview: body.needsReview,
      });

      await deps.auditLogger.record({
        name: 'ReceiptItemUpdated',
        actorUserId: request.auth!.userId,
        workspaceId,
        occurredAt: new Date(),
        payload: { captureId, itemId },
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/items/bulk-assign',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        body: bulkAssignReceiptItemsRequestSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const body = bulkAssignReceiptItemsRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const userId = request.auth!.userId;

      await bulkAssign.execute({
        captureId,
        workspaceId,
        userId,
        itemIds: body.itemIds,
        subcategoryId: body.subcategoryId,
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/items/bulk-ignore',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        body: bulkIgnoreReceiptItemsRequestSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const body = bulkIgnoreReceiptItemsRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const userId = request.auth!.userId;

      await bulkIgnore.execute({
        captureId,
        workspaceId,
        userId,
        itemIds: body.itemIds,
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/confirm',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        body: confirmReceiptCaptureRequestSchema,
        response: { 200: receiptConfirmationResultDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const body = confirmReceiptCaptureRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const userId = request.auth!.userId;

      const result = await confirmCapture.execute({
        captureId,
        workspaceId,
        userId,
        competenceYear: body.competenceYear,
        competenceMonth: body.competenceMonth,
        attributedMemberId: body.attributedMemberId,
      });

      const response: ReceiptConfirmationResultDto = result;
      return reply.send(response);
    },
  );

  app.get(
    '/v1/receipt-captures',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        querystring: receiptCaptureListQuerySchema,
      },
      preHandler: readGuard,
    },
    async (request, reply) => {
      const query = receiptCaptureListQuerySchema.parse(request.query);
      const workspaceId = request.workspace!.workspaceId;

      const { items, totalItems } = await deps.enrichment.listSummaries(workspaceId, {
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page,
        pageSize: query.pageSize,
      });

      return reply.send({
        data: items,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
        },
      });
    },
  );

  app.post(
    '/v1/receipt-captures/:captureId/reprocess',
    {
      schema: {
        tags: ['Receipts'],
        security: [{ BearerAuth: [] }],
        params: captureParamsSchema,
        response: { 200: receiptCaptureDtoSchema },
      },
      preHandler: writeGuard,
    },
    async (request, reply) => {
      const { captureId } = captureParamsSchema.parse(request.params);
      const workspaceId = request.workspace!.workspaceId;

      await reprocessCapture.execute({
        captureId,
        workspaceId,
        provider: deps.env.RECEIPT_EXTRACTOR_PROVIDER,
        jobId: randomUUID(),
      });

      const dto = await fetchEnrichedDto(deps, captureId, workspaceId);
      return reply.send(dto);
    },
  );
}
