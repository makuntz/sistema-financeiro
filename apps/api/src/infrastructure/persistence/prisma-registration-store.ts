import type { PrismaClient } from '@pp-planning/database';
import type {
  User,
  AuthSession,
  Workspace,
  WorkspaceMember,
  RegistrationStore,
} from '@pp-planning/domain';

export class PrismaRegistrationStore implements RegistrationStore {
  constructor(private readonly prisma: PrismaClient) {}

  async register(input: {
    user: User;
    workspace: Workspace;
    membership: WorkspaceMember;
    session: AuthSession;
  }): Promise<void> {
    const userProps = input.user.toProps();
    const wsProps = input.workspace.toProps();
    const memProps = input.membership.toProps();
    const sessProps = input.session.toProps();

    await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          id: userProps.id,
          name: userProps.name,
          email: userProps.email,
          normalizedEmail: userProps.normalizedEmail,
          passwordHash: userProps.passwordHash,
          isActive: userProps.isActive,
          createdAt: userProps.createdAt,
          updatedAt: userProps.updatedAt,
        },
      }),
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
      this.prisma.authSession.create({
        data: {
          id: sessProps.id,
          userId: sessProps.userId,
          refreshTokenHash: sessProps.refreshTokenHash,
          expiresAt: sessProps.expiresAt,
          revokedAt: sessProps.revokedAt,
          lastUsedAt: sessProps.lastUsedAt,
          userAgent: sessProps.userAgent,
          ipAddress: sessProps.ipAddress,
          createdAt: sessProps.createdAt,
          updatedAt: sessProps.updatedAt,
        },
      }),
    ]);
  }
}
