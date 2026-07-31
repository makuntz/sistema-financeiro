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
  throw new Error(
    'TEST_DATABASE_URL ou DATABASE_URL é obrigatória nos testes de integração (CI usa Postgres na porta 5432).',
  );
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

describe('Auth, workspaces, invitations e taxonomy protegida', () => {
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

  it('GET /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.json()).toHaveProperty('version', '0.1.0');
  });

  it('cadastra usuário, cria workspace owner e autentica /me', async () => {
    const registered = await register(app, {
      name: 'Leandro Silva',
      email: 'leandro@example.com',
    });

    expect(registered.workspace.name).toBe('Planejamento de Leandro');
    expect(registered.workspace.role).toBe('owner');

    const me = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${registered.tokens.accessToken}` },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('leandro@example.com');
  });

  it('login, refresh com rotação e logout', async () => {
    await register(app, {
      name: 'Ana',
      email: 'ana@example.com',
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ana@example.com', password: 'senha-segura-10' },
    });
    expect(login.statusCode).toBe(200);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: login.json().tokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);

    const oldRefresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: login.json().tokens.refreshToken },
    });
    expect(oldRefresh.statusCode).toBe(401);

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: refresh.json().tokens.refreshToken },
    });
    expect(logout.statusCode).toBe(204);

    const logoutAgain = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: refresh.json().tokens.refreshToken },
    });
    expect(logoutAgain.statusCode).toBe(204);
  });

  it('rejeita credenciais inválidas com mensagem genérica', async () => {
    await register(app, { name: 'Ana', email: 'ana2@example.com' });

    const badPassword = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ana2@example.com', password: 'senha-errada-xx' },
    });
    expect(badPassword.statusCode).toBe(401);
    expect(badPassword.json().error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'naoexiste@example.com', password: 'senha-errada-xx' },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error.message).toBe('E-mail ou senha inválidos.');
  });

  it('convida, aceita e compartilha workspace entre dois usuários', async () => {
    const owner = await register(app, {
      name: 'Marido',
      email: 'marido@example.com',
    });
    const spouse = await register(app, {
      name: 'Esposa',
      email: 'esposa@example.com',
    });

    const invite = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/current/invitations',
      headers: {
        authorization: `Bearer ${owner.tokens.accessToken}`,
        'x-workspace-id': owner.workspace.id,
      },
      payload: { email: 'esposa@example.com', role: 'owner' },
    });

    expect(invite.statusCode).toBe(201);
    expect(invite.json().invitationLink).toContain('/convites/');
    const token = String(invite.json().invitationLink).split('/').pop();

    const accept = await app.inject({
      method: 'POST',
      url: `/v1/invitations/${token}/accept`,
      headers: { authorization: `Bearer ${spouse.tokens.accessToken}` },
    });
    expect(accept.statusCode).toBe(200);

    const workspaces = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: { authorization: `Bearer ${spouse.tokens.accessToken}` },
    });
    expect(workspaces.statusCode).toBe(200);
    expect(
      workspaces
        .json()
        .data.some(
          (item: { workspace: { id: string } }) => item.workspace.id === owner.workspace.id,
        ),
    ).toBe(true);

    const createCategory = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        authorization: `Bearer ${spouse.tokens.accessToken}`,
        'x-workspace-id': owner.workspace.id,
      },
      payload: { name: 'Mercado', type: 'expense' },
    });
    expect(createCategory.statusCode).toBe(201);

    const listAsOwner = await app.inject({
      method: 'GET',
      url: '/v1/categories',
      headers: {
        authorization: `Bearer ${owner.tokens.accessToken}`,
        'x-workspace-id': owner.workspace.id,
      },
    });
    expect(listAsOwner.statusCode).toBe(200);
    expect(listAsOwner.json().data).toHaveLength(1);
  });

  it('bloqueia taxonomy sem auth e sem workspace', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      payload: { name: 'Moradia', type: 'expense' },
    });
    expect(unauth.statusCode).toBe(401);

    const user = await register(app, { name: 'User', email: 'user@example.com' });
    const noWorkspace = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: { authorization: `Bearer ${user.tokens.accessToken}` },
      payload: { name: 'Moradia', type: 'expense' },
    });
    expect(noWorkspace.statusCode).toBe(400);
    expect(noWorkspace.json().error.code).toBe('WORKSPACE_REQUIRED');
  });

  it('rejeita workspaceId no body e exige X-Workspace-Id', async () => {
    const user = await register(app, { name: 'User', email: 'body@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: {
        authorization: `Bearer ${user.tokens.accessToken}`,
        'x-workspace-id': user.workspace.id,
      },
      payload: {
        workspaceId: user.workspace.id,
        name: 'Moradia',
        type: 'expense',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('protege último owner e permite múltiplos owners', async () => {
    const a = await register(app, { name: 'Ana Owner', email: 'a@example.com' });
    const b = await register(app, { name: 'Bruno Spouse', email: 'b@example.com' });

    const invite = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/current/invitations',
      headers: {
        authorization: `Bearer ${a.tokens.accessToken}`,
        'x-workspace-id': a.workspace.id,
      },
      payload: { email: 'b@example.com', role: 'member' },
    });
    const token = String(invite.json().invitationLink).split('/').pop();

    await app.inject({
      method: 'POST',
      url: `/v1/invitations/${token}/accept`,
      headers: { authorization: `Bearer ${b.tokens.accessToken}` },
    });

    const members = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/current/members',
      headers: {
        authorization: `Bearer ${a.tokens.accessToken}`,
        'x-workspace-id': a.workspace.id,
      },
    });
    const memberB = members.json().data.find((m: { email: string }) => m.email === 'b@example.com');

    const promote = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/current/members/${memberB.id}/role`,
      headers: {
        authorization: `Bearer ${a.tokens.accessToken}`,
        'x-workspace-id': a.workspace.id,
      },
      payload: { role: 'owner' },
    });
    expect(promote.statusCode).toBe(204);

    const leaveAfterPromote = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/current/leave',
      headers: {
        authorization: `Bearer ${a.tokens.accessToken}`,
        'x-workspace-id': a.workspace.id,
      },
    });
    expect(leaveAfterPromote.statusCode).toBe(204);

    // Recreate scenario for last owner: single owner cannot leave
    const solo = await register(app, { name: 'Solo', email: 'solo@example.com' });
    const leaveSolo = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/current/leave',
      headers: {
        authorization: `Bearer ${solo.tokens.accessToken}`,
        'x-workspace-id': solo.workspace.id,
      },
    });
    expect(leaveSolo.statusCode).toBe(409);
    expect(leaveSolo.json().error.code).toBe('LAST_OWNER_REQUIRED');
  });

  it('mismatches e-mail no aceite do convite', async () => {
    const owner = await register(app, { name: 'Owner', email: 'owner@example.com' });
    const other = await register(app, { name: 'Other', email: 'other@example.com' });

    const invite = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/current/invitations',
      headers: {
        authorization: `Bearer ${owner.tokens.accessToken}`,
        'x-workspace-id': owner.workspace.id,
      },
      payload: { email: 'convidado@example.com', role: 'member' },
    });
    const token = String(invite.json().invitationLink).split('/').pop();

    const accept = await app.inject({
      method: 'POST',
      url: `/v1/invitations/${token}/accept`,
      headers: { authorization: `Bearer ${other.tokens.accessToken}` },
    });

    expect(accept.statusCode).toBe(403);
    expect(accept.json().error.code).toBe('INVITATION_EMAIL_MISMATCH');
  });
});
