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

describe('Reports - Monthly Budget Comparison', () => {
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

  it('compares planned vs realized amounts', async () => {
    const user = await register(app, { name: 'Owner', email: 'reports-plan@test.com' });
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
      method: 'PUT',
      url: '/v1/planning/monthly/2026/7',
      headers,
      payload: {
        expectedVersion: null,
        items: [
          { subcategoryId: incomeSub, plannedAmountInCents: '500000' },
          { subcategoryId: expenseSub, plannedAmountInCents: '200000' },
        ],
      },
    });

    await app.inject({
      method: 'POST',
      url: '/v1/ledger/entries',
      headers,
      payload: {
        subcategoryId: incomeSub,
        description: 'Salário recebido',
        amountInCents: '450000',
        occurredOn: '2026-07-05',
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
        description: 'Aluguel pago',
        amountInCents: '180000',
        occurredOn: '2026-07-10',
        competenceYear: 2026,
        competenceMonth: 7,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reports/monthly-budget/2026/7',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.currency).toBe('BRL');
    expect(body.totalPlannedIncomeInCents).toBe('500000');
    expect(body.totalRealizedIncomeInCents).toBe('450000');
    expect(body.totalPlannedExpenseInCents).toBe('200000');
    expect(body.totalRealizedExpenseInCents).toBe('180000');
    expect(body.projectedBalanceInCents).toBe('300000');
    expect(body.realizedBalanceInCents).toBe('270000');
    expect(body.incomeBalanceInCents).toBe('-50000');
    expect(body.expenseBalanceInCents).toBe('20000');
  });

  it('excludes voided entries from realized totals', async () => {
    const user = await register(app, { name: 'Owner', email: 'reports-void@test.com' });
    const headers = {
      authorization: `Bearer ${user.tokens.accessToken}`,
      'x-workspace-id': user.workspace.id,
    };

    const { subcategoryId } = await createCategoryAndSubcategory(
      app,
      headers,
      'Moradia',
      'expense',
      'Aluguel',
    );

    await app.inject({
      method: 'PUT',
      url: '/v1/planning/monthly/2026/7',
      headers,
      payload: {
        expectedVersion: null,
        items: [{ subcategoryId, plannedAmountInCents: '200000' }],
      },
    });

    const activeRes = await app.inject({
      method: 'POST',
      url: '/v1/ledger/entries',
      headers,
      payload: {
        subcategoryId,
        description: 'Ativo',
        amountInCents: '150000',
        occurredOn: '2026-07-05',
        competenceYear: 2026,
        competenceMonth: 7,
      },
    });

    const voidedRes = await app.inject({
      method: 'POST',
      url: '/v1/ledger/entries',
      headers,
      payload: {
        subcategoryId,
        description: 'Será void',
        amountInCents: '50000',
        occurredOn: '2026-07-10',
        competenceYear: 2026,
        competenceMonth: 7,
      },
    });
    const voidedEntry = voidedRes.json();

    await app.inject({
      method: 'POST',
      url: `/v1/ledger/entries/${voidedEntry.id}/void`,
      headers,
      payload: { expectedVersion: 1 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reports/monthly-budget/2026/7',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.totalRealizedExpenseInCents).toBe('150000');
    expect(activeRes.statusCode).toBe(201);
  });

  it('shows negative difference when expense exceeds plan', async () => {
    const user = await register(app, { name: 'Owner', email: 'reports-over@test.com' });
    const headers = {
      authorization: `Bearer ${user.tokens.accessToken}`,
      'x-workspace-id': user.workspace.id,
    };

    const { subcategoryId } = await createCategoryAndSubcategory(
      app,
      headers,
      'Moradia',
      'expense',
      'Aluguel',
    );

    await app.inject({
      method: 'PUT',
      url: '/v1/planning/monthly/2026/7',
      headers,
      payload: {
        expectedVersion: null,
        items: [{ subcategoryId, plannedAmountInCents: '200000' }],
      },
    });

    await app.inject({
      method: 'POST',
      url: '/v1/ledger/entries',
      headers,
      payload: {
        subcategoryId,
        description: 'Gasto acima',
        amountInCents: '250000',
        occurredOn: '2026-07-05',
        competenceYear: 2026,
        competenceMonth: 7,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/reports/monthly-budget/2026/7',
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    const expenseCat = body.categories.find((c: { kind: string }) => c.kind === 'expense');
    expect(expenseCat.differenceInCents).toBe('-50000');
    expect(expenseCat.subcategories[0].differenceInCents).toBe('-50000');
    expect(body.expenseBalanceInCents).toBe('-50000');
  });
});
