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

describe('Planning - Monthly Plan', () => {
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
        url: '/v1/planning/monthly/2026/7',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /v1/planning/monthly/:year/:month', () => {
    it('returns empty plan when none exists', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-get@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      await createCategoryAndSubcategory(app, headers, 'Salário', 'income', 'Salário principal');

      const res = await app.inject({
        method: 'GET',
        url: '/v1/planning/monthly/2026/7',
        headers,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.exists).toBe(false);
      expect(body.id).toBeNull();
      expect(body.version).toBeNull();
      expect(body.categories.length).toBeGreaterThan(0);
    });

    it('rejects invalid period', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-period@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const res = await app.inject({
        method: 'GET',
        url: '/v1/planning/monthly/2026/13',
        headers,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /v1/planning/monthly/:year/:month', () => {
    it('creates and retrieves a plan', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-put@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId: subId1 } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Salário principal',
      );
      const { subcategoryId: subId2 } = await createCategoryAndSubcategory(
        app,
        headers,
        'Moradia',
        'expense',
        'Aluguel',
      );

      const putRes = await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers,
        payload: {
          expectedVersion: null,
          items: [
            { subcategoryId: subId1, plannedAmountInCents: '500000' },
            { subcategoryId: subId2, plannedAmountInCents: '200000' },
          ],
        },
      });
      expect(putRes.statusCode).toBe(200);
      const plan = putRes.json();
      expect(plan.exists).toBe(true);
      expect(plan.version).toBe(1);
      expect(plan.totals.incomePlannedInCents).toBe('500000');
      expect(plan.totals.expensePlannedInCents).toBe('200000');
      expect(plan.totals.projectedBalanceInCents).toBe('300000');
    });

    it('BigInt values as strings work correctly', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-bigint@test.com' });
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

      const putRes = await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers,
        payload: {
          expectedVersion: null,
          items: [{ subcategoryId, plannedAmountInCents: '99999999999' }],
        },
      });
      expect(putRes.statusCode).toBe(200);
      const plan = putRes.json();
      const cat = plan.categories.find((c: { subcategories: Array<{ id: string }> }) =>
        c.subcategories.some((s: { id: string }) => s.id === subcategoryId),
      );
      const sub = cat?.subcategories.find((s: { id: string }) => s.id === subcategoryId);
      expect(sub?.plannedAmountInCents).toBe('99999999999');
    });
  });

  describe('Version conflict', () => {
    it('rejects stale version on update', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-conflict@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        headers,
        'Salário',
        'income',
        'Salário principal',
      );

      await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers,
        payload: {
          expectedVersion: null,
          items: [{ subcategoryId, plannedAmountInCents: '500000' }],
        },
      });

      const conflictRes = await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers,
        payload: {
          expectedVersion: 99,
          items: [{ subcategoryId, plannedAmountInCents: '600000' }],
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().error.code).toBe('PLAN_VERSION_CONFLICT');
    });
  });

  describe('Workspace isolation', () => {
    it('plans are isolated per workspace', async () => {
      const user1 = await register(app, { name: 'User1', email: 'plan-iso1@test.com' });
      const user2 = await register(app, { name: 'User2', email: 'plan-iso2@test.com' });

      const h1 = {
        authorization: `Bearer ${user1.tokens.accessToken}`,
        'x-workspace-id': user1.workspace.id,
      };
      const h2 = {
        authorization: `Bearer ${user2.tokens.accessToken}`,
        'x-workspace-id': user2.workspace.id,
      };

      const { subcategoryId } = await createCategoryAndSubcategory(
        app,
        h1,
        'Salário',
        'income',
        'Principal',
      );

      await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers: h1,
        payload: {
          expectedVersion: null,
          items: [{ subcategoryId, plannedAmountInCents: '500000' }],
        },
      });

      const res2 = await app.inject({
        method: 'GET',
        url: '/v1/planning/monthly/2026/7',
        headers: h2,
      });
      expect(res2.json().exists).toBe(false);
    });
  });

  describe('POST /v1/planning/monthly/:year/:month/copy-previous', () => {
    it('copies previous month plan', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-copy@test.com' });
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

      await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/6',
        headers,
        payload: {
          expectedVersion: null,
          items: [{ subcategoryId, plannedAmountInCents: '500000' }],
        },
      });

      const copyRes = await app.inject({
        method: 'POST',
        url: '/v1/planning/monthly/2026/7/copy-previous',
        headers,
        payload: { overwrite: false, expectedVersion: null },
      });
      expect(copyRes.statusCode).toBe(200);
      const copyBody = copyRes.json();
      expect(copyBody.exists).toBe(true);
      expect(copyBody.totals.incomePlannedInCents).toBe('500000');
    });

    it('returns 404 when no previous plan', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-no-prev@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const copyRes = await app.inject({
        method: 'POST',
        url: '/v1/planning/monthly/2026/7/copy-previous',
        headers,
        payload: { overwrite: false, expectedVersion: null },
      });
      expect(copyRes.statusCode).toBe(404);
      expect(copyRes.json().error.code).toBe('PREVIOUS_PLAN_NOT_FOUND');
    });
  });

  describe('Permission enforcement', () => {
    it('viewer can read but cannot write plans', async () => {
      const owner = await register(app, { name: 'Owner', email: 'plan-perm-owner@test.com' });
      const viewer = await register(app, { name: 'Viewer', email: 'plan-perm-viewer@test.com' });

      const invite = await app.inject({
        method: 'POST',
        url: '/v1/workspaces/current/invitations',
        headers: {
          authorization: `Bearer ${owner.tokens.accessToken}`,
          'x-workspace-id': owner.workspace.id,
        },
        payload: { email: 'plan-perm-viewer@test.com', role: 'viewer' },
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
        url: '/v1/planning/monthly/2026/7',
        headers: viewerHeaders,
      });
      expect(readRes.statusCode).toBe(200);

      const writeRes = await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers: viewerHeaders,
        payload: {
          expectedVersion: null,
          items: [],
        },
      });
      expect(writeRes.statusCode).toBe(403);
    });
  });

  describe('DB constraints', () => {
    it('rejects negative amount at DB level', async () => {
      const user = await register(app, { name: 'Owner', email: 'plan-neg@test.com' });
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

      const res = await app.inject({
        method: 'PUT',
        url: '/v1/planning/monthly/2026/7',
        headers,
        payload: {
          expectedVersion: null,
          items: [{ subcategoryId, plannedAmountInCents: '-100' }],
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
