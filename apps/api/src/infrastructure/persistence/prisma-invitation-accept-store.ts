import type { PrismaClient } from '@pp-planning/database';
import type { WorkspaceInvitation, WorkspaceMember } from '@pp-planning/domain';

export type InvitationAcceptStore = {
  accept(input: { invitation: WorkspaceInvitation; membership: WorkspaceMember }): Promise<void>;
};

export class PrismaInvitationAcceptStore implements InvitationAcceptStore {
  constructor(private readonly prisma: PrismaClient) {}

  async accept(input: {
    invitation: WorkspaceInvitation;
    membership: WorkspaceMember;
  }): Promise<void> {
    const invProps = input.invitation.toProps();
    const memProps = input.membership.toProps();

    await this.prisma.$transaction([
      this.prisma.workspaceInvitation.update({
        where: { id: invProps.id },
        data: {
          acceptedAt: invProps.acceptedAt,
          acceptedByUserId: invProps.acceptedByUserId,
          updatedAt: invProps.updatedAt,
        },
      }),
      this.prisma.workspaceMember.upsert({
        where: { id: memProps.id },
        create: {
          id: memProps.id,
          workspaceId: memProps.workspaceId,
          userId: memProps.userId,
          role: memProps.role,
          isActive: memProps.isActive,
          joinedAt: memProps.joinedAt,
          createdAt: memProps.createdAt,
          updatedAt: memProps.updatedAt,
        },
        update: {
          role: memProps.role,
          isActive: memProps.isActive,
          updatedAt: memProps.updatedAt,
        },
      }),
    ]);
  }
}
