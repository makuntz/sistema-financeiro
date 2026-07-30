import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  logoutRequestSchema,
  registerResponseSchema,
  loginResponseSchema,
  refreshResponseSchema,
  meResponseSchema,
} from '@pp-planning/contracts';
import type {
  RegisterUser,
  LoginUser,
  RefreshSession,
  LogoutSession,
  GetAuthenticatedUser,
} from '@pp-planning/domain';

export type AuthRoutesDeps = {
  registerUser: RegisterUser;
  loginUser: LoginUser;
  refreshSession: RefreshSession;
  logoutSession: LogoutSession;
  getAuthenticatedUser: GetAuthenticatedUser;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthRoutesDeps,
): Promise<void> {
  app.post(
    '/v1/auth/register',
    {
      schema: {
        tags: ['Auth'],
        body: registerRequestSchema,
        response: { 201: registerResponseSchema },
      },
    },
    async (request, reply) => {
      const body = registerRequestSchema.parse(request.body);

      const result = await deps.registerUser.execute({
        name: body.name,
        email: body.email,
        password: body.password,
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        user: result.user.toPublic(),
        tokens: result.tokens,
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
          role: result.membership.role,
        },
      });
    },
  );

  app.post(
    '/v1/auth/login',
    {
      schema: {
        tags: ['Auth'],
        body: loginRequestSchema,
        response: { 200: loginResponseSchema },
      },
    },
    async (request) => {
      const body = loginRequestSchema.parse(request.body);

      const result = await deps.loginUser.execute({
        email: body.email,
        password: body.password,
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip,
      });

      return {
        user: result.user.toPublic(),
        tokens: result.tokens,
      };
    },
  );

  app.post(
    '/v1/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        body: refreshRequestSchema,
        response: { 200: refreshResponseSchema },
      },
    },
    async (request) => {
      const body = refreshRequestSchema.parse(request.body);

      const result = await deps.refreshSession.execute(body.refreshToken);

      return {
        user: result.user.toPublic(),
        tokens: result.tokens,
      };
    },
  );

  app.post(
    '/v1/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        body: logoutRequestSchema,
        response: { 204: { type: 'null' as const } },
      },
    },
    async (request, reply) => {
      const body = logoutRequestSchema.parse(request.body);
      await deps.logoutSession.execute(body.refreshToken);
      return reply.status(204).send();
    },
  );

  app.get(
    '/v1/auth/me',
    {
      schema: {
        tags: ['Auth'],
        security: [{ BearerAuth: [] }],
        response: { 200: meResponseSchema },
      },
      preHandler: [deps.authenticate],
    },
    async (request) => {
      const auth = request.auth!;
      const user = await deps.getAuthenticatedUser.execute(auth.userId);
      return user.toPublic();
    },
  );
}
