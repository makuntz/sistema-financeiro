import type { PrismaClient } from '@pp-planning/database';
import { AuthSession, type SessionRepository } from '@pp-planning/domain';

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<AuthSession | null> {
    const row = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hash },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(session: AuthSession): Promise<void> {
    const props = session.toProps();

    await this.prisma.authSession.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        userId: props.userId,
        refreshTokenHash: props.refreshTokenHash,
        expiresAt: props.expiresAt,
        revokedAt: props.revokedAt,
        lastUsedAt: props.lastUsedAt,
        userAgent: props.userAgent,
        ipAddress: props.ipAddress,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        refreshTokenHash: props.refreshTokenHash,
        expiresAt: props.expiresAt,
        revokedAt: props.revokedAt,
        lastUsedAt: props.lastUsedAt,
        updatedAt: props.updatedAt,
      },
    });
  }

  async rotate(input: { previous: AuthSession; next: AuthSession }): Promise<void> {
    const prev = input.previous.toProps();
    const next = input.next.toProps();

    await this.prisma.$transaction([
      this.prisma.authSession.update({
        where: { id: prev.id },
        data: {
          revokedAt: prev.revokedAt,
          updatedAt: prev.updatedAt,
        },
      }),
      this.prisma.authSession.create({
        data: {
          id: next.id,
          userId: next.userId,
          refreshTokenHash: next.refreshTokenHash,
          expiresAt: next.expiresAt,
          revokedAt: next.revokedAt,
          lastUsedAt: next.lastUsedAt,
          userAgent: next.userAgent,
          ipAddress: next.ipAddress,
          createdAt: next.createdAt,
          updatedAt: next.updatedAt,
        },
      }),
    ]);
  }

  private toDomain(row: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AuthSession {
    return AuthSession.reconstitute(row);
  }
}
