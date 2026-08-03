import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '@pp-planning/config/env';
import { createPrismaClient, type PrismaClient } from '@pp-planning/database';
import { buildApp } from '../../../../app.js';
import { getSharedInMemoryFileStorage } from '../../../../infrastructure/storage/s3-file-storage.js';
import { runReceiptWorkerOnce } from '../../index.js';
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
  RECEIPT_EXTRACTOR_PROVIDER: 'fake',
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

describe('Receipt captures - integration smoke', () => {
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
    getSharedInMemoryFileStorage().clear();
    await prisma.ledgerEntry.deleteMany();
    await prisma.receiptProcessingJob.deleteMany();
    await prisma.receiptItem.deleteMany();
    await prisma.receiptImage.deleteMany();
    await prisma.receiptCapture.deleteMany();
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

  it('runs create → upload → process → confirm flow', async () => {
    const auth = await register(app, {
      name: 'Receipt User',
      email: `receipt-${Date.now()}@example.com`,
    });
    const headers = {
      authorization: `Bearer ${auth.tokens.accessToken}`,
      'x-workspace-id': auth.workspace.id,
    };

    const { subcategoryId } = await createCategoryAndSubcategory(
      app,
      headers,
      'Mercado',
      'expense',
      'Compras',
    );

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/receipt-captures',
      headers,
      payload: {},
    });
    expect(createRes.statusCode).toBe(201);
    const captureId = createRes.json().id as string;
    expect(createRes.json().status).toBe('draft');

    const uploadUrlRes = await app.inject({
      method: 'POST',
      url: `/v1/receipt-captures/${captureId}/images/upload-url`,
      headers,
      payload: { mimeType: 'image/jpeg', sizeInBytes: 1024 },
    });
    expect(uploadUrlRes.statusCode).toBe(201);
    const { imageId } = uploadUrlRes.json() as { imageId: string };

    const completeRes = await app.inject({
      method: 'PUT',
      url: `/v1/receipt-captures/${captureId}/images/${imageId}/content`,
      headers: {
        ...headers,
        'content-type': 'image/jpeg',
      },
      payload: Buffer.alloc(1024),
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().status).toBe('uploaded');

    const processRes = await app.inject({
      method: 'POST',
      url: `/v1/receipt-captures/${captureId}/process`,
      headers,
    });
    expect(processRes.statusCode).toBe(200);
    expect(processRes.json().status).toBe('processing');

    const processed = await runReceiptWorkerOnce(prisma, testEnv);
    expect(processed).toBe(true);

    const reviewRes = await app.inject({
      method: 'GET',
      url: `/v1/receipt-captures/${captureId}`,
      headers,
    });
    expect(reviewRes.statusCode).toBe(200);
    const reviewBody = reviewRes.json() as {
      status: string;
      items: Array<{ id: string; lineTotalInCents: string | null }>;
      merchantName: string | null;
    };
    expect(reviewBody.status).toBe('review');
    expect(reviewBody.items.length).toBeGreaterThan(0);
    expect(reviewBody.merchantName).toBeTruthy();

    const itemIds = reviewBody.items.map((item) => item.id);
    const assignRes = await app.inject({
      method: 'POST',
      url: `/v1/receipt-captures/${captureId}/items/bulk-assign`,
      headers,
      payload: { itemIds, subcategoryId },
    });
    expect(assignRes.statusCode).toBe(200);

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/v1/receipt-captures/${captureId}/confirm`,
      headers,
      payload: {},
    });
    expect(confirmRes.statusCode).toBe(200);
    const confirmBody = confirmRes.json() as { ledgerEntryIds: string[] };
    expect(confirmBody.ledgerEntryIds.length).toBeGreaterThan(0);

    const finalRes = await app.inject({
      method: 'GET',
      url: `/v1/receipt-captures/${captureId}`,
      headers,
    });
    expect(finalRes.statusCode).toBe(200);
    expect(finalRes.json().status).toBe('confirmed');

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { receiptCaptureId: captureId, workspaceId: auth.workspace.id },
    });
    expect(ledgerEntries.length).toBe(confirmBody.ledgerEntryIds.length);
    for (const entry of ledgerEntries) {
      expect(entry.origin).toBe('receipt');
      expect(entry.receiptCaptureId).toBe(captureId);
      expect(entry.kind).toBe('expense');
    }
  });
});
