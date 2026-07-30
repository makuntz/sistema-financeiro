import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryAuditLogger } from '../shared/audit.js';
import { Email } from './email.js';
import { assertPassword, UserName } from './user-name.js';
import { DomainError } from '../shared/domain-error.js';
import { RegisterUser } from './register-user.js';
import type { PasswordHasher, TokenService } from './ports.js';
import type { UserRepository } from './user-repository.js';
import type { RegistrationStore } from './register-user.js';
import { User } from './user.js';
import type { AuthSession } from './auth-session.js';
import type { Workspace } from '../workspaces/workspace.js';
import type { WorkspaceMember } from '../workspaces/workspace-member.js';

class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hash:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hash:${password}`;
  }
}

class FakeTokens implements TokenService {
  async issueTokens(input: { userId: string; sessionId: string }) {
    return {
      accessToken: `access:${input.userId}:${input.sessionId}`,
      refreshToken: `refresh:${input.sessionId}`,
      accessTokenExpiresIn: 900,
      refreshTokenHash: `hash-refresh:${input.sessionId}`,
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sessionId: input.sessionId,
    };
  }

  async verifyAccessToken(token: string) {
    const [, userId, sessionId] = token.split(':');
    return { sub: userId ?? '', sid: sessionId ?? '' };
  }

  hashRefreshToken(token: string): string {
    return `sha:${token}`;
  }

  generateOpaqueToken(): string {
    return 'a'.repeat(64);
  }
}

class MemoryUsers implements UserRepository {
  items = new Map<string, User>();

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByNormalizedEmail(normalizedEmail: string) {
    return [...this.items.values()].find((u) => u.normalizedEmail === normalizedEmail) ?? null;
  }

  async save(user: User) {
    this.items.set(user.id, user);
  }
}

class MemoryRegistrationStore implements RegistrationStore {
  users: User[] = [];
  workspaces: Workspace[] = [];
  memberships: WorkspaceMember[] = [];
  sessions: AuthSession[] = [];
  fail = false;

  async register(input: {
    user: User;
    workspace: Workspace;
    membership: WorkspaceMember;
    session: AuthSession;
  }) {
    if (this.fail) {
      throw new Error('boom');
    }
    this.users.push(input.user);
    this.workspaces.push(input.workspace);
    this.memberships.push(input.membership);
    this.sessions.push(input.session);
  }
}

describe('RegisterUser / identity basics', () => {
  let users: MemoryUsers;
  let store: MemoryRegistrationStore;
  let useCase: RegisterUser;

  beforeEach(() => {
    users = new MemoryUsers();
    store = new MemoryRegistrationStore();
    useCase = new RegisterUser(
      users,
      store,
      new FakeHasher(),
      new FakeTokens(),
      new InMemoryAuditLogger(),
    );
  });

  it('cadastra usuário e workspace owner', async () => {
    const result = await useCase.execute({
      name: 'Leandro Silva',
      email: 'Leandro@Example.com',
      password: 'senha-segura-10',
    });

    expect(result.user.normalizedEmail).toBe('leandro@example.com');
    expect(result.workspace.name).toBe('Planejamento de Leandro');
    expect(result.membership.role).toBe('owner');
    expect(store.users).toHaveLength(1);
  });

  it('rejeita e-mail duplicado case-insensitive', async () => {
    await useCase.execute({
      name: 'User A',
      email: 'a@example.com',
      password: 'senha-segura-10',
    });
    // Simulate persisted user for uniqueness check
    users.items.set(
      'x',
      User.create({
        id: 'x',
        name: 'User A',
        email: 'a@example.com',
        passwordHash: 'hash',
      }),
    );

    await expect(
      useCase.execute({
        name: 'User B',
        email: 'A@example.com',
        password: 'senha-segura-10',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_IN_USE' });
  });

  it('valida nome, e-mail e senha', () => {
    expect(() => UserName.create('A')).toThrow(DomainError);
    expect(() => Email.create('invalido')).toThrow(DomainError);
    expect(() => assertPassword('curta')).toThrow(DomainError);
  });
});
