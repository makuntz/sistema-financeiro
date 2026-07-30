import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  workspaceSchema,
  workspaceSummarySchema,
  listWorkspacesResponseSchema,
  listMembersResponseSchema,
  changeMemberRoleRequestSchema,
  createInvitationRequestSchema,
  createInvitationResponseSchema,
  listInvitationsResponseSchema,
  invitationPreviewSchema,
} from '@pp-planning/contracts';
import type {
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
  WorkspaceMemberRepository,
  WorkspaceRepository,
  WorkspaceInvitationRepository,
  Permission,
  Workspace,
  WorkspaceInvitation,
} from '@pp-planning/domain';
import { maskEmail } from '@pp-planning/domain';

export type WorkspaceRoutesDeps = {
  createWorkspace: CreateWorkspace;
  listUserWorkspaces: ListUserWorkspaces;
  updateCurrentWorkspace: UpdateCurrentWorkspace;
  createWorkspaceInvitation: CreateWorkspaceInvitation;
  acceptWorkspaceInvitation: AcceptWorkspaceInvitation;
  declineWorkspaceInvitation: DeclineWorkspaceInvitation;
  revokeWorkspaceInvitation: RevokeWorkspaceInvitation;
  getInvitationPreview: GetInvitationPreview;
  changeMemberRole: ChangeMemberRole;
  deactivateMember: DeactivateMember;
  leaveWorkspace: LeaveWorkspace;
  memberRepository: WorkspaceMemberRepository;
  workspaceRepository: WorkspaceRepository;
  invitationRepository: WorkspaceInvitationRepository;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (permission: Permission) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  webUrl: string;
};

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  deps: WorkspaceRoutesDeps,
): Promise<void> {
  const { authenticate, requireWorkspace, requirePermission } = deps;

  // --- Workspaces ---

  app.get(
    '/v1/workspaces',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        response: { 200: listWorkspacesResponseSchema },
      },
      preHandler: [authenticate],
    },
    async (request) => {
      const items = await deps.listUserWorkspaces.execute(request.auth!.userId);

      return {
        data: items.map((item) => ({
          workspace: presentWorkspace(item.workspace),
          role: item.role,
          membershipId: item.membershipId,
        })),
      };
    },
  );

  app.post(
    '/v1/workspaces',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        body: createWorkspaceRequestSchema,
        response: { 201: workspaceSummarySchema },
      },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const body = createWorkspaceRequestSchema.parse(request.body);
      const result = await deps.createWorkspace.execute({
        userId: request.auth!.userId,
        name: body.name,
      });

      return reply.status(201).send({
        workspace: presentWorkspace(result.workspace),
        role: result.membership.role,
        membershipId: result.membership.id,
      });
    },
  );

  app.get(
    '/v1/workspaces/current',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        response: { 200: workspaceSchema },
      },
      preHandler: [authenticate, requireWorkspace],
    },
    async (request) => {
      const ws = await deps.workspaceRepository.findById(request.workspace!.workspaceId);
      return presentWorkspace(ws!);
    },
  );

  app.patch(
    '/v1/workspaces/current',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        body: updateWorkspaceRequestSchema,
        response: { 200: workspaceSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('workspace.update')],
    },
    async (request) => {
      const body = updateWorkspaceRequestSchema.parse(request.body);
      const ws = await deps.updateCurrentWorkspace.execute({
        workspaceId: request.workspace!.workspaceId,
        name: body.name,
        locale: body.locale,
        timezone: body.timezone,
      });
      return presentWorkspace(ws);
    },
  );

  // --- Members ---

  app.get(
    '/v1/workspaces/current/members',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        response: { 200: listMembersResponseSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('members.read')],
    },
    async (request) => {
      const members = await deps.memberRepository.listActiveByWorkspace(
        request.workspace!.workspaceId,
      );

      return {
        data: members.map((item) => ({
          id: item.member.id,
          userId: item.member.userId,
          name: item.user.name,
          email: item.user.email,
          role: item.member.role,
          isActive: item.member.isActive,
          joinedAt: item.member.joinedAt.toISOString(),
        })),
      };
    },
  );

  app.patch(
    '/v1/workspaces/current/members/:memberId/role',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        params: z.object({ memberId: z.string().uuid() }),
        body: changeMemberRoleRequestSchema,
        response: { 204: { type: 'null' as const } },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('members.manage')],
    },
    async (request, reply) => {
      const { memberId } = request.params as { memberId: string };
      const body = changeMemberRoleRequestSchema.parse(request.body);

      await deps.changeMemberRole.execute({
        workspaceId: request.workspace!.workspaceId,
        actorUserId: request.auth!.userId,
        actorRole: request.workspace!.role,
        membershipId: memberId,
        nextRole: body.role,
      });

      return reply.status(204).send();
    },
  );

  app.delete(
    '/v1/workspaces/current/members/:memberId',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        params: z.object({ memberId: z.string().uuid() }),
        response: { 204: { type: 'null' as const } },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('members.manage')],
    },
    async (request, reply) => {
      const { memberId } = request.params as { memberId: string };

      await deps.deactivateMember.execute({
        workspaceId: request.workspace!.workspaceId,
        actorUserId: request.auth!.userId,
        actorRole: request.workspace!.role,
        membershipId: memberId,
      });

      return reply.status(204).send();
    },
  );

  app.post(
    '/v1/workspaces/current/leave',
    {
      schema: {
        tags: ['Workspaces'],
        security: [{ BearerAuth: [] }],
        response: { 204: { type: 'null' as const } },
      },
      preHandler: [authenticate, requireWorkspace],
    },
    async (request, reply) => {
      await deps.leaveWorkspace.execute({
        workspaceId: request.workspace!.workspaceId,
        userId: request.auth!.userId,
      });

      return reply.status(204).send();
    },
  );

  // --- Invitations (workspace-scoped) ---

  app.post(
    '/v1/workspaces/current/invitations',
    {
      schema: {
        tags: ['Invitations'],
        security: [{ BearerAuth: [] }],
        body: createInvitationRequestSchema,
        response: { 201: createInvitationResponseSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('invitations.create')],
    },
    async (request, reply) => {
      const body = createInvitationRequestSchema.parse(request.body);

      const result = await deps.createWorkspaceInvitation.execute({
        workspaceId: request.workspace!.workspaceId,
        actorUserId: request.auth!.userId,
        actorRole: request.workspace!.role,
        email: body.email,
        role: body.role,
        appBaseUrl: deps.webUrl,
      });

      return reply.status(201).send({
        invitation: presentInvitation(result.invitation),
        invitationLink: result.invitationLink,
      });
    },
  );

  app.get(
    '/v1/workspaces/current/invitations',
    {
      schema: {
        tags: ['Invitations'],
        security: [{ BearerAuth: [] }],
        response: { 200: listInvitationsResponseSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('invitations.read')],
    },
    async (request) => {
      const items = await deps.invitationRepository.listByWorkspace(
        request.workspace!.workspaceId,
      );

      return { data: items.map(presentInvitation) };
    },
  );

  app.post(
    '/v1/workspaces/current/invitations/:invitationId/revoke',
    {
      schema: {
        tags: ['Invitations'],
        security: [{ BearerAuth: [] }],
        params: z.object({ invitationId: z.string().uuid() }),
        response: { 204: { type: 'null' as const } },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('invitations.revoke')],
    },
    async (request, reply) => {
      const { invitationId } = request.params as { invitationId: string };

      await deps.revokeWorkspaceInvitation.execute({
        invitationId,
        workspaceId: request.workspace!.workspaceId,
        actorUserId: request.auth!.userId,
      });

      return reply.status(204).send();
    },
  );

  // --- Invitations (public by token) ---

  app.get(
    '/v1/invitations/:token',
    {
      schema: {
        tags: ['Invitations'],
        params: z.object({ token: z.string().min(1) }),
        response: { 200: invitationPreviewSchema },
      },
    },
    async (request) => {
      const { token } = request.params as { token: string };
      const preview = await deps.getInvitationPreview.execute(token);

      return {
        workspaceName: preview.workspaceName,
        invitedByName: preview.invitedByName,
        email: maskEmail(preview.invitation.invitedEmail),
        role: preview.invitation.role,
        status: preview.invitation.status(),
        expiresAt: preview.invitation.expiresAt.toISOString(),
      };
    },
  );

  app.post(
    '/v1/invitations/:token/accept',
    {
      schema: {
        tags: ['Invitations'],
        security: [{ BearerAuth: [] }],
        params: z.object({ token: z.string().min(1) }),
        response: {
          200: z.object({
            workspaceId: z.string().uuid(),
            membershipId: z.string().uuid(),
          }),
        },
      },
      preHandler: [authenticate],
    },
    async (request) => {
      const { token } = request.params as { token: string };
      const result = await deps.acceptWorkspaceInvitation.execute({
        token,
        userId: request.auth!.userId,
      });

      return {
        workspaceId: result.workspaceId,
        membershipId: result.membership.id,
      };
    },
  );

  app.post(
    '/v1/invitations/:token/decline',
    {
      schema: {
        tags: ['Invitations'],
        security: [{ BearerAuth: [] }],
        params: z.object({ token: z.string().min(1) }),
        response: { 204: { type: 'null' as const } },
      },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      await deps.declineWorkspaceInvitation.execute({
        token,
        userId: request.auth!.userId,
      });

      return reply.status(204).send();
    },
  );
}

function presentWorkspace(ws: Workspace) {
  return {
    id: ws.id,
    name: ws.name,
    currency: ws.currency,
    locale: ws.locale,
    timezone: ws.timezone,
    isActive: ws.isActive,
    createdAt: ws.createdAt.toISOString(),
    updatedAt: ws.updatedAt.toISOString(),
  };
}

function presentInvitation(inv: WorkspaceInvitation) {
  return {
    id: inv.id,
    workspaceId: inv.workspaceId,
    email: inv.invitedEmail,
    role: inv.role,
    status: inv.status(),
    invitedByUserId: inv.invitedByUserId,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  };
}
