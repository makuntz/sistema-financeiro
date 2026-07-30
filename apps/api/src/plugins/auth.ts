import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TokenService, SessionRepository, WorkspaceMemberRepository, Permission } from '@pp-planning/domain';
import { permissionsForRole } from '@pp-planning/domain';
import type { AuthContext, WorkspaceContext } from '../shared/contexts.js';
import { AppError } from '../shared/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
    workspace?: WorkspaceContext;
  }
}

export type AuthPluginDeps = {
  tokenService: TokenService;
  sessionRepository: SessionRepository;
  memberRepository: WorkspaceMemberRepository;
};

export function createAuthHandlers(deps: AuthPluginDeps) {
  const { tokenService, sessionRepository, memberRepository } = deps;

  async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('INVALID_ACCESS_TOKEN', 'Token de acesso ausente ou inválido.', 401);
    }

    const jwt = header.slice(7);
    let claims: { sub: string; sid: string };

    try {
      claims = await tokenService.verifyAccessToken(jwt);
    } catch {
      throw new AppError('INVALID_ACCESS_TOKEN', 'Token de acesso inválido ou expirado.', 401);
    }

    const session = await sessionRepository.findById(claims.sid);
    if (!session || !session.isUsable()) {
      throw new AppError('SESSION_REVOKED', 'Sessão revogada ou expirada.', 401);
    }

    request.auth = { userId: claims.sub, sessionId: claims.sid };
  }

  async function requireWorkspace(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const workspaceId = request.headers['x-workspace-id'];
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError('WORKSPACE_REQUIRED', 'Header X-Workspace-Id é obrigatório.', 400);
    }

    const auth = request.auth;
    if (!auth) {
      throw new AppError('INVALID_ACCESS_TOKEN', 'Autenticação necessária.', 401);
    }

    const member = await memberRepository.findActiveByWorkspaceAndUser(workspaceId, auth.userId);
    if (!member) {
      throw new AppError('WORKSPACE_ACCESS_DENIED', 'Acesso ao workspace negado.', 403);
    }

    request.workspace = {
      workspaceId,
      membershipId: member.id,
      role: member.role,
      permissions: permissionsForRole(member.role),
    };
  }

  function requirePermission(permission: Permission) {
    return async function checkPermission(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const ctx = request.workspace;
      if (!ctx) {
        throw new AppError('WORKSPACE_REQUIRED', 'Contexto de workspace ausente.', 400);
      }

      if (!ctx.permissions.includes(permission)) {
        throw new AppError(
          'INSUFFICIENT_PERMISSION',
          `Permissão '${permission}' necessária.`,
          403,
        );
      }
    };
  }

  return { authenticate, requireWorkspace, requirePermission };
}
