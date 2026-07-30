import { beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '@pp-planning/config/env';
import { InMemoryCategoryRepository } from '@pp-planning/domain';
import { createPrismaClient } from '@pp-planning/database';
import { buildApp } from '../../../../app.js';

const testEnv = loadEnv({
  NODE_ENV: 'test',
  PORT: '3333',
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://pp_planning:pp_planning_dev@localhost:5432/pp_planning?schema=public',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3333',
  MOBILE_API_URL: 'http://localhost:3333',
  JWT_SECRET: 'test-secret-at-least-16',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'pp-planning',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
});

describe('API integration', () => {
  const workspaceA = '11111111-1111-1111-1111-111111111111';
  const workspaceB = '22222222-2222-2222-2222-222222222222';
  let repository: InMemoryCategoryRepository;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository();
  });

  it('GET /health retorna status da aplicação', async () => {
    const prisma = createPrismaClient(testEnv.DATABASE_URL);
    const { app } = await buildApp({
      env: testEnv,
      prisma,
      categoryRepository: repository,
      useInMemoryPersistence: true,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    const body = response.json();
    expect(body.version).toBe('0.1.0');
    expect(body.checks).toHaveProperty('database');
    expect(['ok', 'degraded', 'error']).toContain(body.status);

    await app.close();
    await prisma.$disconnect();
  });

  it('cria e lista categorias', async () => {
    const prisma = createPrismaClient(testEnv.DATABASE_URL);
    const { app } = await buildApp({
      env: testEnv,
      prisma,
      categoryRepository: repository,
      useInMemoryPersistence: true,
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: {
        workspaceId: workspaceA,
        name: 'Moradia',
        type: 'expense',
        color: '#0F766E',
        icon: 'home',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().name).toBe('Moradia');

    const listResponse = await app.inject({
      method: 'GET',
      url: `/v1/categories?workspaceId=${workspaceA}`,
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);

    await app.close();
    await prisma.$disconnect();
  });

  it('rejeita categoria duplicada no mesmo workspace', async () => {
    const prisma = createPrismaClient(testEnv.DATABASE_URL);
    const { app } = await buildApp({
      env: testEnv,
      prisma,
      categoryRepository: repository,
      useInMemoryPersistence: true,
    });

    await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: {
        workspaceId: workspaceA,
        name: 'Alimentação',
        type: 'expense',
      },
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: {
        workspaceId: workspaceA,
        name: 'alimentação',
        type: 'expense',
      },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('CATEGORY_ALREADY_EXISTS');

    await app.close();
    await prisma.$disconnect();
  });

  it('permite mesmo nome em workspaces diferentes', async () => {
    const prisma = createPrismaClient(testEnv.DATABASE_URL);
    const { app } = await buildApp({
      env: testEnv,
      prisma,
      categoryRepository: repository,
      useInMemoryPersistence: true,
    });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: {
        workspaceId: workspaceA,
        name: 'Transporte',
        type: 'expense',
      },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: {
        workspaceId: workspaceB,
        name: 'Transporte',
        type: 'expense',
      },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    await app.close();
    await prisma.$disconnect();
  });

  it('rejeita nome inválido', async () => {
    const prisma = createPrismaClient(testEnv.DATABASE_URL);
    const { app } = await buildApp({
      env: testEnv,
      prisma,
      categoryRepository: repository,
      useInMemoryPersistence: true,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: {
        workspaceId: workspaceA,
        name: 'A',
        type: 'expense',
      },
    });

    // Zod valida min(2) antes do domínio — ambos são válidos para o contrato da API
    expect([400]).toContain(response.statusCode);

    await app.close();
    await prisma.$disconnect();
  });
});
