import type { AuditLogger } from '../shared/audit.js';
import type { TokenService } from './ports.js';
import type { SessionRepository } from './session-repository.js';

export class LogoutSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(hash);

    if (!session || session.isRevoked()) {
      return;
    }

    session.revoke();
    await this.sessions.save(session);

    await this.audit?.record({
      name: 'SessionRevoked',
      actorUserId: session.userId,
      occurredAt: new Date(),
      payload: { sessionId: session.id },
    });
  }
}
