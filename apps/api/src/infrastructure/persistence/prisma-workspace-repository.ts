import type { PrismaClient } from '@pp-planning/database';
import { Workspace, type WorkspaceRepository } from '@pp-planning/domain';

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Workspace | null> {
    const row = await this.prisma.workspace.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(workspace: Workspace): Promise<void> {
    const props = workspace.toProps();

    await this.prisma.workspace.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        name: props.name,
        currency: props.currency,
        locale: props.locale,
        timezone: props.timezone,
        isActive: props.isActive,
        createdByUserId: props.createdByUserId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        name: props.name,
        currency: props.currency,
        locale: props.locale,
        timezone: props.timezone,
        isActive: props.isActive,
        updatedAt: props.updatedAt,
      },
    });
  }

  private toDomain(row: {
    id: string;
    name: string;
    currency: string;
    locale: string;
    timezone: string;
    isActive: boolean;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }): Workspace {
    return Workspace.reconstitute(row);
  }
}
