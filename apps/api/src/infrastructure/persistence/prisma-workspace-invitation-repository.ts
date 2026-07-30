import type { PrismaClient } from '@pp-planning/database';
import {
  WorkspaceInvitation,
  type WorkspaceInvitationRepository,
  type WorkspaceRole,
} from '@pp-planning/domain';

export class PrismaWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<WorkspaceInvitation | null> {
    const row = await this.prisma.workspaceInvitation.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | null> {
    const row = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
    });
    return row ? this.toDomain(row) : null;
  }

  async findPendingByWorkspaceAndEmail(
    workspaceId: string,
    normalizedEmail: string,
  ): Promise<WorkspaceInvitation | null> {
    const row = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        normalizedEmail,
        revokedAt: null,
        acceptedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const rows = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(invitation: WorkspaceInvitation): Promise<void> {
    const props = invitation.toProps();

    await this.prisma.workspaceInvitation.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        workspaceId: props.workspaceId,
        invitedEmail: props.invitedEmail,
        normalizedEmail: props.normalizedEmail,
        role: props.role,
        tokenHash: props.tokenHash,
        invitedByUserId: props.invitedByUserId,
        expiresAt: props.expiresAt,
        acceptedAt: props.acceptedAt,
        acceptedByUserId: props.acceptedByUserId,
        declinedAt: props.declinedAt,
        revokedAt: props.revokedAt,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        acceptedAt: props.acceptedAt,
        acceptedByUserId: props.acceptedByUserId,
        declinedAt: props.declinedAt,
        revokedAt: props.revokedAt,
        updatedAt: props.updatedAt,
      },
    });
  }

  async revokePendingAndCreate(input: {
    previous: WorkspaceInvitation | null;
    next: WorkspaceInvitation;
  }): Promise<void> {
    const nextProps = input.next.toProps();

    await this.prisma.$transaction(async (tx) => {
      if (input.previous) {
        const prevProps = input.previous.toProps();
        await tx.workspaceInvitation.update({
          where: { id: prevProps.id },
          data: {
            revokedAt: prevProps.revokedAt,
            updatedAt: prevProps.updatedAt,
          },
        });
      }

      await tx.workspaceInvitation.create({
        data: {
          id: nextProps.id,
          workspaceId: nextProps.workspaceId,
          invitedEmail: nextProps.invitedEmail,
          normalizedEmail: nextProps.normalizedEmail,
          role: nextProps.role,
          tokenHash: nextProps.tokenHash,
          invitedByUserId: nextProps.invitedByUserId,
          expiresAt: nextProps.expiresAt,
          acceptedAt: nextProps.acceptedAt,
          acceptedByUserId: nextProps.acceptedByUserId,
          declinedAt: nextProps.declinedAt,
          revokedAt: nextProps.revokedAt,
          createdAt: nextProps.createdAt,
          updatedAt: nextProps.updatedAt,
        },
      });
    });
  }

  private toDomain(row: {
    id: string;
    workspaceId: string;
    invitedEmail: string;
    normalizedEmail: string;
    role: WorkspaceRole;
    tokenHash: string;
    invitedByUserId: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    acceptedByUserId: string | null;
    declinedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceInvitation {
    return WorkspaceInvitation.reconstitute(row);
  }
}
