import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '@pp-planning/config/env';
import { createPrismaClient, type PrismaClient } from '@pp-planning/database';
import { buildApp } from '../../../../app.js';
import type { FastifyInstance } from 'fastify';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  (process.env.CI
    ? undefined
    : 'postgresql://pp_planning:pp_planning_dev@localhost:5433/pp_planning_test?schema=public');

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL ou DATABASE_URL é obrigatória nos testes de integração.');
}

const testEnv = loadEnv({
  NODE_ENV: 'test',
  PORT: '3333',
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3333',
  MOBILE_API_URL: 'http://localhost:3333',
  JWT_SECRET: 'test-secret-at-least-16-chars',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  PASSWORD_HASH_MEMORY_COST: '4096',
  PASSWORD_HASH_TIME_COST: '1',
  PASSWORD_HASH_PARALLELISM: '1',
});

async function register(
  app: FastifyInstance,
  input: { name: string; email: string; password?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: input.name,
      email: input.email,
      password: input.password ?? 'senha-segura-10',
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as {
    user: { id: string; name: string; email: string };
    workspace: { id: string; name: string; role: string };
    tokens: { accessToken: string; refreshToken: string; accessTokenExpiresIn: number };
  };
}

async function createCategoryAndSubcategory(
  app: FastifyInstance,
  headers: Record<string, string>,
  catName: string,
  catType: string,
  subName: string,
): Promise<{ categoryId: string; subcategoryId: string }> {
  const catRes = await app.inject({
    method: 'POST',
    url: '/v1/categories',
    headers,
    payload: { name: catName, type: catType, color: '#16A34A', icon: 'wallet' },
  });
  const categoryId = catRes.json().id as string;

  const subRes = await app.inject({
    method: 'POST',
    url: `/v1/categories/${categoryId}/subcategories`,
    headers,
    payload: { name: subName },
  });
  const subcategoryId = subRes.json().id as string;

  return { categoryId, subcategoryId };
}

describe('Ledger - Entries', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    prisma = createPrismaClient(testEnv.DATABASE_URL);
    const built = await buildApp({ env: testEnv, prisma });
    app = built.app;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.monthlyPlanItem.deleteMany();
    await prisma.monthlyPlan.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.workspaceInvitation.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Auth requirements', () => {
    it('returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Create and list entries', () => {
    it('creates expense and income entries with enrichment', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-create@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId: incomeSub } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Salário principal',
      );
      const { subcategoryId: expenseSub } = await createCategoryAndSubcategory(
        app,
        headers,
        'Moradia',
        'expense',
        'Aluguel',
      );

      const incomeRes = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId: incomeSub,
          description: 'Salário julho',
          notes: 'Pagamento mensal',
          amountInCents: '500000',
          occurredOn: '2026-07-15',
          competenceYear: 2026,
          competenceMonth: 7,
        },
      });
      expect(incomeRes.statusCode).toBe(201);
      const income = incomeRes.json();
      expect(income.kind).toBe('income');
      expect(income.amountInCents).toBe('500000');
      expect(income.subcategoryName).toBe('Salário principal');
      expect(income.categoryName).toBe('Salário');
      expect(income.notes).toBe('Pagamento mensal');
      expect(income.createdByName).toBe('Owner');
      expect(income.subcategoryIsActive).toBe(true);
      expect(income.categoryIsActive).toBe(true);

      const expenseRes = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId: expenseSub,
          description: 'Aluguel julho',
          amountInCents: '200000',
          occurredOn: '2026-07-05',
          competenceYear: 2026,
          competenceMonth: 7,
        },
      });
      expect(expenseRes.statusCode).toBe(201);
      expect(expenseRes.json().kind).toBe('expense');

      const listRes = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries?competenceYear=2026&competenceMonth=7',
        headers,
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data).toHaveLength(2);
    });

    it('filters by kind and search', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-filter@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId: incomeSub } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Principal',
      );
      const { subcategoryId: expenseSub } = await createCategoryAndSubcategory(
        app,
        headers,
        'Moradia',
        'expense',
        'Aluguel',
      );

      await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId: incomeSub,
          description: 'Salário especial',
          notes: 'Bônus anual',
          amountInCents: '100000',
          occurredOn: '2026-07-01',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId: expenseSub,
          description: 'Conta de luz',
          amountInCents: '50000',
          occurredOn: '2026-07-10',
        },
      });

      const incomeOnly = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries?kind=income',
        headers,
      });
      expect(incomeOnly.json().data).toHaveLength(1);
      expect(incomeOnly.json().data[0].kind).toBe('income');

      const searchRes = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries?search=bônus',
        headers,
      });
      expect(searchRes.json().data).toHaveLength(1);
      expect(searchRes.json().data[0].description).toBe('Salário especial');
    });
  });

  describe('Update and version conflict', () => {
    it('updates entry with expectedVersion', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-update@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Principal',
      );

      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId,
          description: 'Original',
          amountInCents: '100000',
          occurredOn: '2026-07-01',
        },
      });
      const entry = createRes.json();
      expect(entry.version).toBe(1);

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/v1/ledger/entries/${entry.id}`,
        headers,
        payload: {
          description: 'Atualizado',
          notes: 'Nova observação',
          expectedVersion: 1,
        },
      });
      expect(updateRes.statusCode).toBe(200);
      const updated = updateRes.json();
      expect(updated.description).toBe('Atualizado');
      expect(updated.notes).toBe('Nova observação');
      expect(updated.version).toBe(2);
      expect(updated.updatedByUserId).toBe(user.user.id);
    });

    it('returns 409 on version conflict', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-conflict@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Principal',
      );

      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId,
          description: 'Teste',
          amountInCents: '100000',
          occurredOn: '2026-07-01',
        },
      });
      const entry = createRes.json();

      const conflictRes = await app.inject({
        method: 'PATCH',
        url: `/v1/ledger/entries/${entry.id}`,
        headers,
        payload: {
          description: 'Stale',
          expectedVersion: 99,
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().error.code).toBe('LEDGER_ENTRY_VERSION_CONFLICT');
    });
  });

  describe('Void and restore', () => {
    it('voids and restores an entry', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-void@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Principal',
      );

      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId,
          description: 'Para void',
          amountInCents: '100000',
          occurredOn: '2026-07-01',
          competenceYear: 2026,
          competenceMonth: 7,
        },
      });
      const entry = createRes.json();

      const voidRes = await app.inject({
        method: 'POST',
        url: `/v1/ledger/entries/${entry.id}/void`,
        headers,
        payload: { reason: 'Erro de digitação', expectedVersion: 1 },
      });
      expect(voidRes.statusCode).toBe(200);
      expect(voidRes.json().voidedAt).not.toBeNull();
      expect(voidRes.json().voidReason).toBe('Erro de digitação');

      const voidedList = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries?voidedOnly=true',
        headers,
      });
      expect(voidedList.json().data).toHaveLength(1);

      const activeList = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries',
        headers,
      });
      expect(activeList.json().data).toHaveLength(0);

      const restoreRes = await app.inject({
        method: 'POST',
        url: `/v1/ledger/entries/${entry.id}/restore`,
        headers,
        payload: { expectedVersion: 2 },
      });
      expect(restoreRes.statusCode).toBe(200);
      expect(restoreRes.json().voidedAt).toBeNull();
    });
  });

  describe('Monthly summary', () => {
    it('excludes voided entries from summary', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-summary@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId: incomeSub } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Principal',
      );
      const { subcategoryId: expenseSub } = await createCategoryAndSubcategory(
        app,
        headers,
        'Moradia',
        'expense',
        'Aluguel',
      );

      await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId: incomeSub,
          description: 'Ativo',
          amountInCents: '500000',
          occurredOn: '2026-07-01',
          competenceYear: 2026,
          competenceMonth: 7,
        },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId: expenseSub,
          description: 'Será void',
          amountInCents: '200000',
          occurredOn: '2026-07-05',
          competenceYear: 2026,
          competenceMonth: 7,
        },
      });

      const expenseEntry = (
        await app.inject({
          method: 'GET',
          url: '/v1/ledger/entries?kind=expense',
          headers,
        })
      ).json().data[0];

      await app.inject({
        method: 'POST',
        url: `/v1/ledger/entries/${expenseEntry.id}/void`,
        headers,
        payload: { expectedVersion: 1 },
      });

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/v1/ledger/monthly/2026/7/summary',
        headers,
      });
      expect(summaryRes.statusCode).toBe(200);
      const summary = summaryRes.json();
      expect(summary.totalIncomeInCents).toBe('500000');
      expect(summary.totalExpenseInCents).toBe('0');
      expect(summary.balanceInCents).toBe('500000');
      expect(summary.incomeRealizedInCents).toBe('500000');
      expect(summary.expenseRealizedInCents).toBe('0');
      expect(summary.realizedBalanceInCents).toBe('500000');
      expect(summary.currency).toBe('BRL');
      expect(summary.entryCount).toBe(1);
    });
  });

  describe('Permission enforcement', () => {
    it('viewer can read but cannot write ledger entries', async () => {
      const owner = await register(app, { name: 'Owner', email: 'ledger-perm-owner@test.com' });
      const viewer = await register(app, { name: 'Viewer', email: 'ledger-perm-viewer@test.com' });

      const invite = await app.inject({
        method: 'POST',
        url: '/v1/workspaces/current/invitations',
        headers: {
          authorization: `Bearer ${owner.tokens.accessToken}`,
          'x-workspace-id': owner.workspace.id,
        },
        payload: { email: 'ledger-perm-viewer@test.com', role: 'viewer' },
      });
      const token = String(invite.json().invitationLink).split('/').pop();

      await app.inject({
        method: 'POST',
        url: `/v1/invitations/${token}/accept`,
        headers: { authorization: `Bearer ${viewer.tokens.accessToken}` },
      });

      const viewerHeaders = {
        authorization: `Bearer ${viewer.tokens.accessToken}`,
        'x-workspace-id': owner.workspace.id,
      };

      const readRes = await app.inject({
        method: 'GET',
        url: '/v1/ledger/entries',
        headers: viewerHeaders,
      });
      expect(readRes.statusCode).toBe(200);

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        {
          authorization: `Bearer ${owner.tokens.accessToken}`,
          'x-workspace-id': owner.workspace.id,
        },
        'Salário',
        'income',
        'Principal',
      );

      const writeRes = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers: viewerHeaders,
        payload: {
          subcategoryId,
          description: 'Tentativa viewer',
          amountInCents: '100000',
          occurredOn: '2026-07-01',
        },
      });
      expect(writeRes.statusCode).toBe(403);
    });
  });

  describe('BigInt serialization', () => {
    it('returns BigInt amounts as strings', async () => {
      const user = await register(app, { name: 'Owner', email: 'ledger-bigint@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        headers,
        'Investimento',
        'income',
        'Rendimento',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/ledger/entries',
        headers,
        payload: {
          subcategoryId,
          description: 'Grande valor',
          amountInCents: '99999999999',
          occurredOn: '2026-07-01',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().amountInCents).toBe('99999999999');
      expect(typeof res.json().amountInCents).toBe('string');
    });
  });
});
