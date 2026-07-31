import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createPrismaClient, type PrismaClient } from '@pp-planning/database';
import {
  RegisterUser,
  LoginUser,
  RefreshSession,
  LogoutSession,
  GetAuthenticatedUser,
  CreateWorkspace,
  ListUserWorkspaces,
  UpdateCurrentWorkspace,
  CreateWorkspaceInvitation,
  AcceptWorkspaceInvitation,
  DeclineWorkspaceInvitation,
  RevokeWorkspaceInvitation,
  GetInvitationPreview,
  ChangeMemberRole,
  DeactivateMember,
  LeaveWorkspace,
  type CategoryRepository,
  type SubcategoryRepository,
} from '@pp-planning/domain';
import type { Env } from '@pp-planning/config/env';
import { registerErrorHandler } from './shared/error-handler.js';
import { registerRequestId } from './shared/request-id.js';
import { registerHealthRoute } from './modules/system/health-route.js';
import {
  PrismaCategoryRepository,
  PrismaSubcategoryRepository,
  registerTaxonomyRoutes,
} from './modules/taxonomy/index.js';
import { PrismaMonthlyPlanRepository, registerPlanningRoutes } from './modules/planning/index.js';
import { PrismaLedgerEntryRepository, registerLedgerRoutes } from './modules/ledger/index.js';
import { registerReportsRoutes } from './modules/reports/index.js';
import { registerAuthRoutes } from './modules/identity/presentation/http/auth-routes.js';
import { registerWorkspaceRoutes } from './modules/workspaces/presentation/http/workspace-routes.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { JoseTokenService } from './infrastructure/security/jose-token-service.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user-repository.js';
import { PrismaSessionRepository } from './infrastructure/persistence/prisma-session-repository.js';
import { PrismaWorkspaceRepository } from './infrastructure/persistence/prisma-workspace-repository.js';
import { PrismaWorkspaceMemberRepository } from './infrastructure/persistence/prisma-workspace-member-repository.js';
import { PrismaWorkspaceInvitationRepository } from './infrastructure/persistence/prisma-workspace-invitation-repository.js';
import { PrismaRegistrationStore } from './infrastructure/persistence/prisma-registration-store.js';
import { PrismaWorkspaceCreationStore } from './infrastructure/persistence/prisma-workspace-creation-store.js';
import { PrismaInvitationAcceptStore } from './infrastructure/persistence/prisma-invitation-accept-store.js';
import { PrismaAuditLogger } from './infrastructure/persistence/prisma-audit-logger.js';
import { createAuthHandlers } from './plugins/auth.js';

export type AppDependencies = {
  env: Env;
  prisma?: PrismaClient;
  categoryRepository?: CategoryRepository;
  subcategoryRepository?: SubcategoryRepository;
};

export type BuiltApp = {
  app: FastifyInstance;
  prisma: PrismaClient;
};

export async function buildApp(deps: AppDependencies): Promise<BuiltApp> {
  const prisma = deps.prisma ?? createPrismaClient(deps.env.DATABASE_URL);

  // --- Repositories ---
  const prismaCategoryRepo = new PrismaCategoryRepository(prisma);
  const categoryRepository = deps.categoryRepository ?? prismaCategoryRepo;

  const prismaSubcategoryRepo = new PrismaSubcategoryRepository(prisma);
  const subcategoryRepository = deps.subcategoryRepository ?? prismaSubcategoryRepo;

  const userRepository = new PrismaUserRepository(prisma);
  const sessionRepository = new PrismaSessionRepository(prisma);
  const workspaceRepository = new PrismaWorkspaceRepository(prisma);
  const memberRepository = new PrismaWorkspaceMemberRepository(prisma);
  const invitationRepository = new PrismaWorkspaceInvitationRepository(prisma);
  const registrationStore = new PrismaRegistrationStore(prisma);
  const workspaceCreationStore = new PrismaWorkspaceCreationStore(prisma);
  const invitationAcceptStore = new PrismaInvitationAcceptStore(prisma);
  const auditLogger = new PrismaAuditLogger(prisma);

  // --- Security ---
  const passwordHasher = new Argon2PasswordHasher(deps.env);
  const tokenService = new JoseTokenService(deps.env);

  // --- Use Cases ---
  const registerUser = new RegisterUser(
    userRepository,
    registrationStore,
    passwordHasher,
    tokenService,
    auditLogger,
  );
  const loginUser = new LoginUser(
    userRepository,
    sessionRepository,
    passwordHasher,
    tokenService,
    auditLogger,
  );
  const refreshSession = new RefreshSession(
    userRepository,
    sessionRepository,
    tokenService,
    auditLogger,
  );
  const logoutSession = new LogoutSession(sessionRepository, tokenService, auditLogger);
  const getAuthenticatedUser = new GetAuthenticatedUser(userRepository);

  const createWorkspace = new CreateWorkspace(workspaceCreationStore, auditLogger);
  const listUserWorkspaces = new ListUserWorkspaces(workspaceRepository, memberRepository);
  const updateCurrentWorkspace = new UpdateCurrentWorkspace(workspaceRepository);

  const createWorkspaceInvitation = new CreateWorkspaceInvitation(
    workspaceRepository,
    memberRepository,
    invitationRepository,
    tokenService,
    undefined,
    auditLogger,
  );
  const acceptWorkspaceInvitation = new AcceptWorkspaceInvitation(
    invitationRepository,
    memberRepository,
    workspaceRepository,
    userRepository,
    tokenService,
    invitationAcceptStore,
    auditLogger,
  );
  const declineWorkspaceInvitation = new DeclineWorkspaceInvitation(
    invitationRepository,
    userRepository,
    tokenService,
    auditLogger,
  );
  const revokeWorkspaceInvitation = new RevokeWorkspaceInvitation(
    invitationRepository,
    auditLogger,
  );
  const getInvitationPreview = new GetInvitationPreview(
    invitationRepository,
    workspaceRepository,
    userRepository,
    tokenService,
  );
  const changeMemberRole = new ChangeMemberRole(memberRepository, undefined, auditLogger);
  const deactivateMember = new DeactivateMember(memberRepository, undefined, auditLogger);
  const leaveWorkspace = new LeaveWorkspace(memberRepository, undefined, auditLogger);

  // --- Auth Handlers ---
  const { authenticate, requireWorkspace, requirePermission } = createAuthHandlers({
    tokenService,
    sessionRepository,
    memberRepository,
  });

  // --- Fastify setup ---
  const app = Fastify({
    logger: {
      level: deps.env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: [
        'req.headers.authorization',
        'password',
        'refreshToken',
        'accessToken',
        'token',
        'tokenHash',
        'authorization',
        'JWT_SECRET',
      ],
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: [deps.env.WEB_URL, deps.env.MOBILE_API_URL],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'PP Planning API',
        description: 'API do sistema de planejamento financeiro PP Planning',
        version: '0.1.0',
      },
      servers: [{ url: deps.env.API_URL }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'System', description: 'Health checks' },
        { name: 'Auth', description: 'Authentication' },
        { name: 'Workspaces', description: 'Workspace management' },
        { name: 'Invitations', description: 'Workspace invitations' },
        { name: 'Taxonomy', description: 'Categories and taxonomy' },
        { name: 'Planning', description: 'Monthly planning' },
        { name: 'Ledger', description: 'Financial ledger entries' },
        { name: 'Reports', description: 'Financial reports' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  registerRequestId(app);
  registerErrorHandler(app);
  registerHealthRoute(app, prisma);

  await registerAuthRoutes(app, {
    registerUser,
    loginUser,
    refreshSession,
    logoutSession,
    getAuthenticatedUser,
    authenticate,
  });

  await registerWorkspaceRoutes(app, {
    createWorkspace,
    listUserWorkspaces,
    updateCurrentWorkspace,
    createWorkspaceInvitation,
    acceptWorkspaceInvitation,
    declineWorkspaceInvitation,
    revokeWorkspaceInvitation,
    getInvitationPreview,
    changeMemberRole,
    deactivateMember,
    leaveWorkspace,
    memberRepository,
    workspaceRepository,
    invitationRepository,
    authenticate,
    requireWorkspace,
    requirePermission,
    webUrl: deps.env.WEB_URL,
  });

  await registerTaxonomyRoutes(app, {
    categoryRepository,
    categoryWithSubcategoriesProvider: prismaCategoryRepo,
    subcategoryRepository,
    authenticate,
    requireWorkspace,
    requirePermission,
  });

  const prismaMonthlyPlanRepo = new PrismaMonthlyPlanRepository(prisma);

  await registerPlanningRoutes(app, {
    planRepository: prismaMonthlyPlanRepo,
    planItemRepository: prismaMonthlyPlanRepo,
    planStore: prismaMonthlyPlanRepo,
    taxonomyProvider: prismaMonthlyPlanRepo,
    auditLogger,
    authenticate,
    requireWorkspace,
    requirePermission,
  });

  const prismaLedgerRepo = new PrismaLedgerEntryRepository(prisma);

  await registerLedgerRoutes(app, {
    ledgerRepository: prismaLedgerRepo,
    ledgerStore: prismaLedgerRepo,
    ledgerEnrichment: prismaLedgerRepo,
    subcategoryLookup: prismaLedgerRepo,
    memberLookup: prismaLedgerRepo,
    auditLogger,
    authenticate,
    requireWorkspace,
    requirePermission,
  });

  await registerReportsRoutes(app, {
    planningPort: prismaLedgerRepo,
    realizedPort: prismaLedgerRepo,
    taxonomyPort: prismaLedgerRepo,
    authenticate,
    requireWorkspace,
    requirePermission,
  });

  return { app, prisma };
}
