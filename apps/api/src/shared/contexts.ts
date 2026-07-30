import type { WorkspaceRole, Permission } from '@pp-planning/domain';

export type AuthContext = { userId: string; sessionId: string };

export type WorkspaceContext = {
  workspaceId: string;
  membershipId: string;
  role: WorkspaceRole;
  permissions: readonly Permission[];
};
