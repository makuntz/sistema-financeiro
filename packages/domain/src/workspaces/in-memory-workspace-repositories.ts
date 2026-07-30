import type { TokenService } from '../identity/ports.js';
import type { UserRepository } from '../identity/user-repository.js';
import type { User } from '../identity/user.js';
import type {
  MemberWithUser,
  WorkspaceInvitationRepository,
  WorkspaceMemberRepository,
  WorkspaceRepository,
} from './repositories.js';
import type { WorkspaceInvitation } from './workspace-invitation.js';
import type { WorkspaceMember } from './workspace-member.js';
import type { Workspace } from './workspace.js';

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  readonly items = new Map<string, Workspace>();

  async findById(id: string): Promise<Workspace | null> {
    return this.items.get(id) ?? null;
  }

  async save(workspace: Workspace): Promise<void> {
    this.items.set(workspace.id, workspace);
  }
}

export class InMemoryWorkspaceMemberRepository implements WorkspaceMemberRepository {
  readonly items = new Map<string, WorkspaceMember>();
  readonly users = new Map<string, { id: string; name: string; email: string }>();

  seedMember(member: WorkspaceMember, user: { id: string; name: string; email: string }): void {
    this.items.set(member.id, member);
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<WorkspaceMember | null> {
    return this.items.get(id) ?? null;
  }

  async findActiveByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return (
      [...this.items.values()].find(
        (member) =>
          member.workspaceId === workspaceId && member.userId === userId && member.isActive,
      ) ?? null
    );
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return (
      [...this.items.values()].find(
        (member) => member.workspaceId === workspaceId && member.userId === userId,
      ) ?? null
    );
  }

  async listActiveByUser(userId: string): Promise<WorkspaceMember[]> {
    return [...this.items.values()].filter(
      (member) => member.userId === userId && member.isActive,
    );
  }

  async listActiveByWorkspace(workspaceId: string): Promise<MemberWithUser[]> {
    return [...this.items.values()]
      .filter((member) => member.workspaceId === workspaceId && member.isActive)
      .map((member) => ({
        member,
        user: this.users.get(member.userId) ?? {
          id: member.userId,
          name: 'Unknown',
          email: 'unknown@example.com',
        },
      }));
  }

  async countActiveOwners(workspaceId: string): Promise<number> {
    return [...this.items.values()].filter(
      (member) =>
        member.workspaceId === workspaceId && member.isActive && member.role === 'owner',
    ).length;
  }

  async save(member: WorkspaceMember): Promise<void> {
    this.items.set(member.id, member);
  }
}

export class InMemoryWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  readonly items = new Map<string, WorkspaceInvitation>();

  async findById(id: string): Promise<WorkspaceInvitation | null> {
    return this.items.get(id) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | null> {
    return (
      [...this.items.values()].find((invitation) => invitation.tokenHash === tokenHash) ?? null
    );
  }

  async findPendingByWorkspaceAndEmail(
    workspaceId: string,
    normalizedEmail: string,
  ): Promise<WorkspaceInvitation | null> {
    return (
      [...this.items.values()].find(
        (invitation) =>
          invitation.workspaceId === workspaceId &&
          invitation.normalizedEmail === normalizedEmail &&
          invitation.status() === 'pending',
      ) ?? null
    );
  }

  async listByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return [...this.items.values()].filter(
      (invitation) => invitation.workspaceId === workspaceId,
    );
  }

  async save(invitation: WorkspaceInvitation): Promise<void> {
    this.items.set(invitation.id, invitation);
  }

  async revokePendingAndCreate(input: {
    previous: WorkspaceInvitation | null;
    next: WorkspaceInvitation;
  }): Promise<void> {
    if (input.previous) {
      this.items.set(input.previous.id, input.previous);
    }
    this.items.set(input.next.id, input.next);
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.items.get(id) ?? null;
  }

  async findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return (
      [...this.items.values()].find((user) => user.normalizedEmail === normalizedEmail) ?? null
    );
  }

  async save(user: User): Promise<void> {
    this.items.set(user.id, user);
  }
}

export class FakeTokenService implements TokenService {
  private counter = 0;

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
    this.counter += 1;
    return `token-${this.counter}-${'a'.repeat(48)}`;
  }
}

export class MemoryAcceptStore {
  readonly calls: Array<{
    invitation: WorkspaceInvitation;
    membership: WorkspaceMember;
  }> = [];

  fail = false;

  constructor(
    private readonly invitations: InMemoryWorkspaceInvitationRepository,
    private readonly members: InMemoryWorkspaceMemberRepository,
  ) {}

  async accept(input: {
    invitation: WorkspaceInvitation;
    membership: WorkspaceMember;
  }): Promise<void> {
    if (this.fail) {
      throw new Error('accept transaction failed');
    }

    this.calls.push(input);
    await this.invitations.save(input.invitation);
    await this.members.save(input.membership);
  }
}
