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

describe('Taxonomy Stage 3 - Categories & Subcategories', () => {
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

  describe('Category CRUD', () => {
    it('cria categoria e lista com subcategorias aninhadas', async () => {
      const user = await register(app, { name: 'Owner', email: 'owner@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const create = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Mantimentos', type: 'expense', color: '#16A34A', icon: 'shopping-cart' },
      });
      expect(create.statusCode).toBe(201);
      const category = create.json();
      expect(category.name).toBe('Mantimentos');
      expect(category.icon).toBe('shopping-cart');

      const list = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers,
      });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toHaveLength(1);
      expect(list.json().data[0].subcategories).toEqual([]);
    });

    it('atualiza categoria (PATCH)', async () => {
      const user = await register(app, { name: 'Owner', email: 'owner2@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const create = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Moradia', type: 'expense', color: '#9333EA', icon: 'home' },
      });
      const categoryId = create.json().id;

      const patch = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${categoryId}`,
        headers,
        payload: { name: 'Moradia Atualizada', color: '#FF0000' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json().name).toBe('Moradia Atualizada');
      expect(patch.json().color).toBe('#FF0000');
    });

    it('inativa e reativa categoria', async () => {
      const user = await register(app, { name: 'Owner', email: 'owner3@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const create = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Transporte', type: 'expense', color: '#2563EB', icon: 'car' },
      });
      const categoryId = create.json().id;

      const inactivate = await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/inactivate`,
        headers,
      });
      expect(inactivate.statusCode).toBe(200);
      expect(inactivate.json().isActive).toBe(false);

      // Default listing excludes inactive
      const listActive = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers,
      });
      expect(listActive.json().data).toHaveLength(0);

      // Include inactive
      const listAll = await app.inject({
        method: 'GET',
        url: '/v1/categories?includeInactive=true',
        headers,
      });
      expect(listAll.json().data).toHaveLength(1);

      const reactivate = await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/reactivate`,
        headers,
      });
      expect(reactivate.statusCode).toBe(200);
      expect(reactivate.json().isActive).toBe(true);
    });

    it('filtra categorias por type e search', async () => {
      const user = await register(app, { name: 'Owner', email: 'owner4@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Salário', type: 'income', color: '#16A34A', icon: 'wallet' },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Mantimentos', type: 'expense', color: '#16A34A', icon: 'shopping-cart' },
      });

      const incomeOnly = await app.inject({
        method: 'GET',
        url: '/v1/categories?type=income',
        headers,
      });
      expect(incomeOnly.json().data).toHaveLength(1);
      expect(incomeOnly.json().data[0].name).toBe('Salário');

      const search = await app.inject({
        method: 'GET',
        url: '/v1/categories?search=mant',
        headers,
      });
      expect(search.json().data).toHaveLength(1);
      expect(search.json().data[0].name).toBe('Mantimentos');
    });
  });

  describe('Subcategory CRUD', () => {
    it('cria subcategoria dentro de categoria ativa', async () => {
      const user = await register(app, { name: 'Owner', email: 'sub1@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const cat = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Mantimentos', type: 'expense', color: '#16A34A', icon: 'shopping-cart' },
      });
      const categoryId = cat.json().id;

      const sub = await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Mercado semanal' },
      });
      expect(sub.statusCode).toBe(201);
      expect(sub.json().name).toBe('Mercado semanal');
      expect(sub.json().categoryId).toBe(categoryId);
    });

    it('rejeita subcategoria em categoria inativa', async () => {
      const user = await register(app, { name: 'Owner', email: 'sub2@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const cat = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Transporte', type: 'expense', color: '#2563EB', icon: 'car' },
      });
      const categoryId = cat.json().id;

      await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/inactivate`,
        headers,
      });

      const sub = await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Combustível' },
      });
      expect(sub.statusCode).toBe(400);
      expect(sub.json().error.code).toBe('CATEGORY_INACTIVE');
    });

    it('rejeita subcategoria duplicada', async () => {
      const user = await register(app, { name: 'Owner', email: 'sub3@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const cat = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Saúde', type: 'expense', color: '#DC2626', icon: 'heart' },
      });
      const categoryId = cat.json().id;

      await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Farmácia' },
      });

      const dup = await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'farmácia' },
      });
      expect(dup.statusCode).toBe(409);
      expect(dup.json().error.code).toBe('SUBCATEGORY_ALREADY_EXISTS');
    });

    it('atualiza e inativa/reativa subcategoria', async () => {
      const user = await register(app, { name: 'Owner', email: 'sub4@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const cat = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Moradia', type: 'expense', color: '#9333EA', icon: 'home' },
      });
      const categoryId = cat.json().id;

      const sub = await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Aluguel' },
      });
      const subId = sub.json().id;

      const patch = await app.inject({
        method: 'PATCH',
        url: `/v1/subcategories/${subId}`,
        headers,
        payload: { name: 'Aluguel mensal' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json().name).toBe('Aluguel mensal');

      const inactivate = await app.inject({
        method: 'POST',
        url: `/v1/subcategories/${subId}/inactivate`,
        headers,
      });
      expect(inactivate.statusCode).toBe(200);
      expect(inactivate.json().isActive).toBe(false);

      const reactivate = await app.inject({
        method: 'POST',
        url: `/v1/subcategories/${subId}/reactivate`,
        headers,
      });
      expect(reactivate.statusCode).toBe(200);
      expect(reactivate.json().isActive).toBe(true);
    });

    it('lista subcategories por categoria', async () => {
      const user = await register(app, { name: 'Owner', email: 'sub5@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const cat = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Mantimentos', type: 'expense', color: '#16A34A', icon: 'shopping-cart' },
      });
      const categoryId = cat.json().id;

      await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Mercado semanal' },
      });
      await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Feira' },
      });

      const list = await app.inject({
        method: 'GET',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
      });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toHaveLength(2);
    });

    it('subcategories aparecem nested na listagem de categorias', async () => {
      const user = await register(app, { name: 'Owner', email: 'sub6@test.com' });
      const headers = {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      };

      const cat = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers,
        payload: { name: 'Saúde', type: 'expense', color: '#DC2626', icon: 'heart' },
      });
      const categoryId = cat.json().id;

      await app.inject({
        method: 'POST',
        url: `/v1/categories/${categoryId}/subcategories`,
        headers,
        payload: { name: 'Plano de saúde' },
      });

      const list = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers,
      });
      expect(list.json().data[0].subcategories).toHaveLength(1);
      expect(list.json().data[0].subcategories[0].name).toBe('Plano de saúde');
    });
  });

  describe('Workspace isolation', () => {
    it('categorias e subcategorias são isoladas por workspace', async () => {
      const user1 = await register(app, { name: 'User1', email: 'u1@test.com' });
      const user2 = await register(app, { name: 'User2', email: 'u2@test.com' });

      const h1 = {
        authorization: `Bearer ${user1.tokens.accessToken}`,
        'x-workspace-id': user1.workspace.id,
      };
      const h2 = {
        authorization: `Bearer ${user2.tokens.accessToken}`,
        'x-workspace-id': user2.workspace.id,
      };

      await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: h1,
        payload: { name: 'Moradia', type: 'expense', color: '#9333EA', icon: 'home' },
      });

      const list2 = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: h2,
      });
      expect(list2.json().data).toHaveLength(0);
    });
  });

  describe('Permission enforcement', () => {
    it('viewer cannot create/update/inactivate categories', async () => {
      const owner = await register(app, { name: 'Owner', email: 'perm-owner@test.com' });
      const viewer = await register(app, { name: 'Viewer', email: 'perm-viewer@test.com' });

      // Invite viewer to owner's workspace
      const invite = await app.inject({
        method: 'POST',
        url: '/v1/workspaces/current/invitations',
        headers: {
          authorization: `Bearer ${owner.tokens.accessToken}`,
          'x-workspace-id': owner.workspace.id,
        },
        payload: { email: 'perm-viewer@test.com', role: 'viewer' },
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

      // Viewer can read
      const list = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: viewerHeaders,
      });
      expect(list.statusCode).toBe(200);

      // Viewer cannot create
      const create = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: viewerHeaders,
        payload: { name: 'Hack', type: 'expense', color: '#000000', icon: 'tag' },
      });
      expect(create.statusCode).toBe(403);
    });
  });
});
