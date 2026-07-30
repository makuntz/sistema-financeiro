import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  currency: z.string(),
  locale: z.string(),
  timezone: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const workspaceSummarySchema = z.object({
  workspace: workspaceSchema,
  role: workspaceRoleSchema,
  membershipId: z.string().uuid(),
});

export const createWorkspaceRequestSchema = z
  .object({
    name: z.string().min(2).max(100),
  })
  .strict();

export const updateWorkspaceRequestSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    locale: z.string().min(2).max(10).optional(),
    timezone: z.string().min(1).max(50).optional(),
  })
  .strict();

export const memberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: workspaceRoleSchema,
  isActive: z.boolean(),
  joinedAt: z.string().datetime(),
});

export const changeMemberRoleRequestSchema = z
  .object({
    role: workspaceRoleSchema,
  })
  .strict();

export const listWorkspacesResponseSchema = z.object({
  data: z.array(workspaceSummarySchema),
});

export const listMembersResponseSchema = z.object({
  data: z.array(memberSchema),
});

export type WorkspaceDto = z.infer<typeof workspaceSchema>;
export type WorkspaceSummaryDto = z.infer<typeof workspaceSummarySchema>;
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;
export type MemberDto = z.infer<typeof memberSchema>;
export type ChangeMemberRoleRequest = z.infer<typeof changeMemberRoleRequestSchema>;
