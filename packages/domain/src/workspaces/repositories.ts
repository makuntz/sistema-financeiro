import type { Workspace } from './workspace.js';
import type { WorkspaceMember } from './workspace-member.js';
import type { WorkspaceInvitation } from './workspace-invitation.js';
import type { WorkspaceRole } from './permissions.js';

export type MemberWithUser = {
  member: WorkspaceMember;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  save(workspace: Workspace): Promise<void>;
}

export interface WorkspaceMemberRepository {
  findById(id: string): Promise<WorkspaceMember | null>;
  findActiveByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null>;
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  listActiveByUser(userId: string): Promise<WorkspaceMember[]>;
  listActiveByWorkspace(workspaceId: string): Promise<MemberWithUser[]>;
  countActiveOwners(workspaceId: string): Promise<number>;
  save(member: WorkspaceMember): Promise<void>;
}

export interface WorkspaceInvitationRepository {
  findById(id: string): Promise<WorkspaceInvitation | null>;
  findByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | null>;
  findPendingByWorkspaceAndEmail(
    workspaceId: string,
    normalizedEmail: string,
  ): Promise<WorkspaceInvitation | null>;
  listByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]>;
  save(invitation: WorkspaceInvitation): Promise<void>;
  revokePendingAndCreate(input: {
    previous: WorkspaceInvitation | null;
    next: WorkspaceInvitation;
  }): Promise<void>;
}

export type UserWorkspaceSummary = {
  workspace: Workspace;
  role: WorkspaceRole;
  membershipId: string;
};
