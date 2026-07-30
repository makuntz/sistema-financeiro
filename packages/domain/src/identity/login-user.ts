import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { AuthSession } from './auth-session.js';
import { Email } from './email.js';
import type { PasswordHasher, TokenService } from './ports.js';
import type { UserRepository } from './user-repository.js';
import type { SessionRepository } from './session-repository.js';
import type { User } from './user.js';

export type LoginUserInput = {
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type LoginUserResult = {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
  };
};

export class LoginUser {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const email = Email.create(input.email);
    const user = await this.users.findByNormalizedEmail(email.normalized);

    if (!user || !user.isActive) {
      throw new DomainError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    const valid = await this.passwordHasher.verify(input.password, user.passwordHash);
    if (!valid) {
      throw new DomainError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    const sessionId = randomUUID();
    const issued = await this.tokens.issueTokens({
      userId: user.id,
      sessionId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    const session = AuthSession.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: issued.refreshTokenHash,
      expiresAt: issued.refreshTokenExpiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    await this.sessions.save(session);

    await this.audit?.record({
      name: 'UserLoggedIn',
      actorUserId: user.id,
      occurredAt: new Date(),
      payload: { userId: user.id, sessionId: session.id },
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
