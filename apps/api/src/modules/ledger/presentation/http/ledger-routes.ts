import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createLedgerEntryRequestSchema,
  updateLedgerEntryRequestSchema,
  voidLedgerEntryRequestSchema,
  restoreLedgerEntryRequestSchema,
  ledgerFiltersQuerySchema,
  ledgerEntryDtoSchema,
  monthlyLedgerSummaryDtoSchema,
  paginate,
  type LedgerEntryDto,
  type LedgerEntryListItemDto,
  type MonthlyLedgerSummaryDto,
  type PaginatedLedgerEntriesResponse,
} from '@pp-planning/contracts';
import {
  CreateLedgerEntry,
  GetLedgerEntry,
  UpdateLedgerEntry,
  VoidLedgerEntry,
  RestoreLedgerEntry,
  GetMonthlyLedgerSummary,
  type LedgerEntryRepository,
  type LedgerEntryStore,
  type LedgerEntryFilters,
  type SubcategoryLookup,
  type MemberLookup,
  type Permission,
  type AuditLogger,
} from '@pp-planning/domain';
import type { EnrichedLedgerEntry } from '../../infrastructure/prisma-ledger-entry-repository.js';

const idParamsSchema = z.object({ entryId: z.string().uuid() });
const periodParamsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
});

export type LedgerEnrichmentPort = {
  findEnrichedByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<EnrichedLedgerEntry | null>;
  findEnrichedByWorkspace(
    workspaceId: string,
    filters?: LedgerEntryFilters,
  ): Promise<EnrichedLedgerEntry[]>;
};

export type LedgerHttpDeps = {
  ledgerRepository: LedgerEntryRepository;
  ledgerStore: LedgerEntryStore;
  ledgerEnrichment: LedgerEnrichmentPort;
  subcategoryLookup: SubcategoryLookup;
  memberLookup: MemberLookup;
  auditLogger: AuditLogger;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (
    permission: Permission,
  ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

function toDto({ entry, enrichment }: EnrichedLedgerEntry): LedgerEntryDto {
  const props = entry.toProps();
  return {
    id: props.id,
    workspaceId: props.workspaceId,
    subcategoryId: props.subcategoryId,
    subcategoryName: enrichment.subcategoryName,
    subcategoryIsActive: enrichment.subcategoryIsActive,
    categoryId: props.categoryId,
    categoryName: enrichment.categoryName,
    categoryIsActive: enrichment.categoryIsActive,
    kind: props.kind,
    description: props.description,
    notes: props.notes,
    amountInCents: props.amountInCents.toString(),
    occurredOn: props.occurredOn,
    competenceYear: props.competenceYear,
    competenceMonth: props.competenceMonth,
    attributedMemberId: props.attributedMemberId,
    attributedMemberName: enrichment.attributedMemberName,
    attributedMemberIsActive: enrichment.attributedMemberIsActive,
    createdByUserId: props.createdByUserId,
    createdByName: enrichment.createdByName,
    updatedByUserId: props.updatedByUserId,
    version: props.version,
    voidedAt: props.voidedAt?.toISOString() ?? null,
    voidedByUserId: props.voidedByUserId,
    voidReason: props.voidReason,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}

function toListItemDto({ entry, enrichment }: EnrichedLedgerEntry): LedgerEntryListItemDto {
  const props = entry.toProps();
  return {
    id: props.id,
    subcategoryId: props.subcategoryId,
    subcategoryName: enrichment.subcategoryName,
    subcategoryIsActive: enrichment.subcategoryIsActive,
    categoryId: props.categoryId,
    categoryName: enrichment.categoryName,
    categoryIsActive: enrichment.categoryIsActive,
    kind: props.kind,
    description: props.description,
    amountInCents: props.amountInCents.toString(),
    occurredOn: props.occurredOn,
    competenceYear: props.competenceYear,
    competenceMonth: props.competenceMonth,
    attributedMemberId: props.attributedMemberId,
    attributedMemberName: enrichment.attributedMemberName,
    version: props.version,
    voidedAt: props.voidedAt?.toISOString() ?? null,
    createdAt: props.createdAt.toISOString(),
  };
}

async function fetchEnriched(
  enrichment: LedgerEnrichmentPort,
  entryId: string,
  workspaceId: string,
): Promise<EnrichedLedgerEntry> {
  const enriched = await enrichment.findEnrichedByIdAndWorkspace(entryId, workspaceId);
  if (!enriched) {
    throw new Error(`Ledger entry ${entryId} not found after mutation`);
  }
  return enriched;
}

export async function registerLedgerRoutes(
  app: FastifyInstance,
  deps: LedgerHttpDeps,
): Promise<void> {
  const createLedgerEntry = new CreateLedgerEntry(
    deps.ledgerStore,
    deps.subcategoryLookup,
    deps.memberLookup,
    deps.auditLogger,
  );
  const getLedgerEntry = new GetLedgerEntry(deps.ledgerRepository);
  const updateLedgerEntry = new UpdateLedgerEntry(
    deps.ledgerRepository,
    deps.ledgerStore,
    deps.subcategoryLookup,
    deps.memberLookup,
    deps.auditLogger,
  );
  const voidLedgerEntry = new VoidLedgerEntry(
    deps.ledgerRepository,
    deps.ledgerStore,
    deps.auditLogger,
  );
  const restoreLedgerEntry = new RestoreLedgerEntry(
    deps.ledgerRepository,
    deps.ledgerStore,
    deps.auditLogger,
  );
  const getMonthlyLedgerSummary = new GetMonthlyLedgerSummary(deps.ledgerRepository);

  const { authenticate, requireWorkspace, requirePermission, ledgerEnrichment } = deps;

  app.post(
    '/v1/ledger/entries',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        body: createLedgerEntryRequestSchema,
        response: { 201: ledgerEntryDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.write')],
    },
    async (request, reply) => {
      const body = createLedgerEntryRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const entry = await createLedgerEntry.execute({
        id: randomUUID(),
        workspaceId,
        subcategoryId: body.subcategoryId,
        description: body.description,
        notes: body.notes,
        amountInCents: BigInt(body.amountInCents),
        occurredOn: body.occurredOn,
        competenceYear: body.competenceYear,
        competenceMonth: body.competenceMonth,
        attributedMemberId: body.attributedMemberId,
        createdByUserId: request.auth!.userId,
      });
      const enriched = await fetchEnriched(ledgerEnrichment, entry.id, workspaceId);
      return reply.status(201).send(toDto(enriched));
    },
  );

  app.get(
    '/v1/ledger/entries',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        querystring: ledgerFiltersQuerySchema,
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.read')],
    },
    async (request) => {
      const query = ledgerFiltersQuerySchema.parse(request.query);
      const enriched = await ledgerEnrichment.findEnrichedByWorkspace(
        request.workspace!.workspaceId,
        {
          kind: query.kind,
          subcategoryId: query.subcategoryId,
          categoryId: query.categoryId,
          competenceYear: query.competenceYear,
          competenceMonth: query.competenceMonth,
          occurredFrom: query.dateFrom ?? query.occurredFrom,
          occurredTo: query.dateTo ?? query.occurredTo,
          includeVoided: query.includeVoided,
          voidedOnly: query.voidedOnly,
          attributedMemberId: query.attributedMemberId,
          search: query.search,
        },
      );

      const items = enriched.map(toListItemDto);
      const result: PaginatedLedgerEntriesResponse = paginate(items, {
        page: query.page,
        pageSize: query.pageSize,
      });
      return result;
    },
  );

  app.get(
    '/v1/ledger/entries/:entryId',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        params: idParamsSchema,
        response: { 200: ledgerEntryDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.read')],
    },
    async (request) => {
      const { entryId } = idParamsSchema.parse(request.params);
      await getLedgerEntry.execute({
        entryId,
        workspaceId: request.workspace!.workspaceId,
      });
      const enriched = await ledgerEnrichment.findEnrichedByIdAndWorkspace(
        entryId,
        request.workspace!.workspaceId,
      );
      if (!enriched) {
        throw new Error(`Ledger entry ${entryId} not found`);
      }
      return toDto(enriched);
    },
  );

  app.patch(
    '/v1/ledger/entries/:entryId',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        params: idParamsSchema,
        body: updateLedgerEntryRequestSchema,
        response: { 200: ledgerEntryDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.write')],
    },
    async (request) => {
      const { entryId } = idParamsSchema.parse(request.params);
      const body = updateLedgerEntryRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      await updateLedgerEntry.execute({
        entryId,
        workspaceId,
        description: body.description,
        notes: body.notes,
        amountInCents: body.amountInCents ? BigInt(body.amountInCents) : undefined,
        occurredOn: body.occurredOn,
        competenceYear: body.competenceYear,
        competenceMonth: body.competenceMonth,
        subcategoryId: body.subcategoryId,
        attributedMemberId: body.attributedMemberId,
        expectedVersion: body.expectedVersion,
        actorUserId: request.auth!.userId,
      });
      const enriched = await fetchEnriched(ledgerEnrichment, entryId, workspaceId);
      return toDto(enriched);
    },
  );

  app.post(
    '/v1/ledger/entries/:entryId/void',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        params: idParamsSchema,
        body: voidLedgerEntryRequestSchema,
        response: { 200: ledgerEntryDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.write')],
    },
    async (request) => {
      const { entryId } = idParamsSchema.parse(request.params);
      const body = voidLedgerEntryRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      await voidLedgerEntry.execute({
        entryId,
        workspaceId,
        reason: body.reason,
        expectedVersion: body.expectedVersion,
        actorUserId: request.auth!.userId,
      });
      const enriched = await fetchEnriched(ledgerEnrichment, entryId, workspaceId);
      return toDto(enriched);
    },
  );

  app.post(
    '/v1/ledger/entries/:entryId/restore',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        params: idParamsSchema,
        body: restoreLedgerEntryRequestSchema,
        response: { 200: ledgerEntryDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.write')],
    },
    async (request) => {
      const { entryId } = idParamsSchema.parse(request.params);
      const body = restoreLedgerEntryRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      await restoreLedgerEntry.execute({
        entryId,
        workspaceId,
        expectedVersion: body.expectedVersion,
        actorUserId: request.auth!.userId,
      });
      const enriched = await fetchEnriched(ledgerEnrichment, entryId, workspaceId);
      return toDto(enriched);
    },
  );

  app.get(
    '/v1/ledger/monthly/:year/:month/summary',
    {
      schema: {
        tags: ['Ledger'],
        security: [{ BearerAuth: [] }],
        params: periodParamsSchema,
        response: { 200: monthlyLedgerSummaryDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('ledger.read')],
    },
    async (request) => {
      const { year, month } = periodParamsSchema.parse(request.params);
      const result = await getMonthlyLedgerSummary.execute({
        workspaceId: request.workspace!.workspaceId,
        year,
        month,
      });

      const balanceStr = result.balanceInCents.toString();
      const dto: MonthlyLedgerSummaryDto = {
        year: result.year,
        month: result.month,
        currency: 'BRL',
        totalIncomeInCents: result.totalIncomeInCents.toString(),
        totalExpenseInCents: result.totalExpenseInCents.toString(),
        balanceInCents: balanceStr,
        incomeRealizedInCents: result.totalIncomeInCents.toString(),
        expenseRealizedInCents: result.totalExpenseInCents.toString(),
        realizedBalanceInCents: balanceStr,
        entryCount: result.entryCount,
      };
      return dto;
    },
  );
}
