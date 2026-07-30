import type { PrismaClient } from '@pp-planning/database';
import type { Workspace, WorkspaceMember, CreateWorkspaceStore } from '@pp-planning/domain';

export class PrismaWorkspaceCreationStore implements CreateWorkspaceStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(workspace: Workspace, membership: WorkspaceMember): Promise<void> {
    const wsProps = workspace.toProps();
    const memProps = membership.toProps();

    await this.prisma.$transaction([
      this.prisma.workspace.create({
        data: {
          id: wsProps.id,
          name: wsProps.name,
          currency: wsProps.currency,
          locale: wsProps.locale,
          timezone: wsProps.timezone,
          isActive: wsProps.isActive,
          createdByUserId: wsProps.createdByUserId,
          createdAt: wsProps.createdAt,
          updatedAt: wsProps.updatedAt,
        },
      }),
      this.prisma.workspaceMember.create({
        data: {
          id: memProps.id,
          workspaceId: memProps.workspaceId,
          userId: memProps.userId,
          role: memProps.role,
          isActive: memProps.isActive,
          joinedAt: memProps.joinedAt,
          createdAt: memProps.createdAt,
          updatedAt: memProps.updatedAt,
        },
      }),
    ]);
  }
}
