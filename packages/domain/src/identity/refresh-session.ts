import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { AuthSession } from './auth-session.js';
import type { TokenService } from './ports.js';
import type { SessionRepository } from './session-repository.js';
import type { UserRepository } from './user-repository.js';
import type { User } from './user.js';

export type RefreshSessionResult = {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
  };
};

export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(refreshToken: string): Promise<RefreshSessionResult> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const current = await this.sessions.findByRefreshTokenHash(hash);

    if (!current) {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'Refresh token inválido.');
    }

    if (current.isRevoked()) {
      throw new DomainError('SESSION_REVOKED', 'Esta sessão foi revogada.');
    }

    if (current.isExpired()) {
      throw new DomainError('REFRESH_TOKEN_EXPIRED', 'O refresh token expirou.');
    }

    const user = await this.users.findById(current.userId);
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE', 'Usuário inativo.');
    }

    current.revoke();

    const nextSessionId = randomUUID();
    const issued = await this.tokens.issueTokens({
      userId: user.id,
      sessionId: nextSessionId,
      userAgent: current.userAgent,
      ipAddress: current.ipAddress,
    });

    const next = AuthSession.create({
      id: nextSessionId,
      userId: user.id,
      refreshTokenHash: issued.refreshTokenHash,
      expiresAt: issued.refreshTokenExpiresAt,
      userAgent: current.userAgent,
      ipAddress: current.ipAddress,
    });
    next.markUsed();

    await this.sessions.rotate({ previous: current, next });

    await this.audit?.record({
      name: 'SessionRefreshed',
      actorUserId: user.id,
      occurredAt: new Date(),
      payload: { previousSessionId: current.id, sessionId: next.id },
    });

    return {
      user,
      tokens: {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        accessTokenExpiresIn: issued.accessTokenExpiresIn,
      },
    };
  }
}
