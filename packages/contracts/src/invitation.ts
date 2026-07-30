import { z } from 'zod';
import { workspaceRoleSchema } from './workspace.js';

export const invitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
]);

export const createInvitationRequestSchema = z
  .object({
    email: z.string().email(),
    role: workspaceRoleSchema,
  })
  .strict();

export const invitationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  email: z.string(),
  role: workspaceRoleSchema,
  status: invitationStatusSchema,
  invitedByUserId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const createInvitationResponseSchema = z.object({
  invitation: invitationSchema,
  invitationLink: z.string().url(),
});

export const listInvitationsResponseSchema = z.object({
  data: z.array(invitationSchema),
});

export const invitationPreviewSchema = z.object({
  workspaceName: z.string(),
  invitedByName: z.string(),
  email: z.string(),
  role: workspaceRoleSchema,
  status: invitationStatusSchema,
  expiresAt: z.string().datetime(),
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type InvitationDto = z.infer<typeof invitationSchema>;
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;
export type InvitationPreviewDto = z.infer<typeof invitationPreviewSchema>;
