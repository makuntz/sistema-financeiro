import type { PrismaClient } from '@pp-planning/database';
import {
  WorkspaceMember,
  type WorkspaceMemberRepository,
  type MemberWithUser,
  type WorkspaceRole,
} from '@pp-planning/domain';

export class PrismaWorkspaceMemberRepository implements WorkspaceMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<WorkspaceMember | null> {
    const row = await this.prisma.workspaceMember.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const row = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, isActive: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const row = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return row ? this.toDomain(row) : null;
  }

  async listActiveByUser(userId: string): Promise<WorkspaceMember[]> {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { userId, isActive: true },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async listActiveByWorkspace(workspaceId: string): Promise<MemberWithUser[]> {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return rows.map((row) => ({
      member: this.toDomain(row),
      user: { id: row.user.id, name: row.user.name, email: row.user.email },
    }));
  }

  async countActiveOwners(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: { workspaceId, role: 'owner', isActive: true },
    });
  }

  async save(member: WorkspaceMember): Promise<void> {
    const props = member.toProps();

    await this.prisma.workspaceMember.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        workspaceId: props.workspaceId,
        userId: props.userId,
        role: props.role,
        isActive: props.isActive,
        joinedAt: props.joinedAt,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        role: props.role,
        isActive: props.isActive,
        updatedAt: props.updatedAt,
      },
    });
  }

  private toDomain(row: {
    id: string;
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    isActive: boolean;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceMember {
    return WorkspaceMember.reconstitute(row);
  }
}
