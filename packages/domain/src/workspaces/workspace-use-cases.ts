import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { Workspace } from './workspace.js';
import { WorkspaceMember } from './workspace-member.js';
import type { WorkspaceMemberRepository, WorkspaceRepository } from './repositories.js';

export type CreateWorkspaceStore = {
  create(workspace: Workspace, membership: WorkspaceMember): Promise<void>;
};

export class CreateWorkspace {
  constructor(
    private readonly store: CreateWorkspaceStore,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    userId: string;
    name: string;
  }): Promise<{ workspace: Workspace; membership: WorkspaceMember }> {
    const workspace = Workspace.create({
      id: randomUUID(),
      name: input.name,
      createdByUserId: input.userId,
    });

    const membership = WorkspaceMember.create({
      id: randomUUID(),
      workspaceId: workspace.id,
      userId: input.userId,
      role: 'owner',
    });

    await this.store.create(workspace, membership);

    await this.audit?.record({
      name: 'WorkspaceCreated',
      actorUserId: input.userId,
      workspaceId: workspace.id,
      occurredAt: new Date(),
      payload: { workspaceId: workspace.id, role: 'owner' },
    });

    return { workspace, membership };
  }
}

export class ListUserWorkspaces {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceMemberRepository,
  ) {}

  async execute(userId: string) {
    const memberships = await this.members.listActiveByUser(userId);
    const result = [];

    for (const membership of memberships) {
      const workspace = await this.workspaces.findById(membership.workspaceId);
      if (workspace?.isActive) {
        result.push({
          workspace,
          role: membership.role,
          membershipId: membership.id,
        });
      }
    }

    return result;
  }
}

export class UpdateCurrentWorkspace {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(input: {
    workspaceId: string;
    name?: string;
    locale?: string;
    timezone?: string;
  }): Promise<Workspace> {
    const workspace = await this.workspaces.findById(input.workspaceId);
    if (!workspace) {
      throw new DomainError('WORKSPACE_ACCESS_DENIED', 'Workspace não encontrado.');
    }

    workspace.assertActive();
    workspace.updateSettings({
      name: input.name,
      locale: input.locale,
      timezone: input.timezone,
    });
    await this.workspaces.save(workspace);
    return workspace;
  }
}
