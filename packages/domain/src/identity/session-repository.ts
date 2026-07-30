import type { AuthSession } from './auth-session.js';

export interface SessionRepository {
  findById(id: string): Promise<AuthSession | null>;
  findByRefreshTokenHash(hash: string): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  rotate(input: {
    previous: AuthSession;
    next: AuthSession;
  }): Promise<void>;
}
