import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { AuthSession } from './auth-session.js';
import { User } from './user.js';
import { Email } from './email.js';
import { UserName, assertPassword } from './user-name.js';
import type { PasswordHasher, TokenService } from './ports.js';
import type { UserRepository } from './user-repository.js';
import { Workspace } from '../workspaces/workspace.js';
import { WorkspaceMember } from '../workspaces/workspace-member.js';

export type RegistrationStore = {
  register(input: {
    user: User;
    workspace: Workspace;
    membership: WorkspaceMember;
    session: AuthSession;
  }): Promise<void>;
};

export type RegisterUserInput = {
  name: string;
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type RegisterUserResult = {
  user: User;
  workspace: Workspace;
  membership: WorkspaceMember;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
  };
};

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly registrationStore: RegistrationStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    const name = UserName.create(input.name);
    const email = Email.create(input.email);
    assertPassword(input.password);

    const existing = await this.users.findByNormalizedEmail(email.normalized);
    if (existing) {
      throw new DomainError('EMAIL_ALREADY_IN_USE', 'Já existe uma conta com este e-mail.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.create({
      id: randomUUID(),
      name: name.value,
      email: email.value,
      passwordHash,
    });

    const workspace = Workspace.create({
      id: randomUUID(),
      name: Workspace.personalName(name.value),
      createdByUserId: user.id,
    });

    const membership = WorkspaceMember.create({
      id: randomUUID(),
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    });

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

    await this.registrationStore.register({
      user,
      workspace,
      membership,
      session,
    });

    await this.audit?.record({
      name: 'UserRegistered',
      actorUserId: user.id,
      workspaceId: workspace.id,
      occurredAt: new Date(),
      payload: { userId: user.id, workspaceId: workspace.id },
    });

    return {
      user,
      workspace,
      membership,
      tokens: {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        accessTokenExpiresIn: issued.accessTokenExpiresIn,
      },
    };
  }
}
