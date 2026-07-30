import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import type { DomainError } from '../shared/domain-error.js';
import { InMemoryAuditLogger } from '../shared/audit.js';
import { User } from '../identity/user.js';
import { AcceptWorkspaceInvitation } from './invitation-use-cases.js';
import {
  FakeTokenService,
  InMemoryUserRepository,
  InMemoryWorkspaceInvitationRepository,
  InMemoryWorkspaceMemberRepository,
  InMemoryWorkspaceRepository,
  MemoryAcceptStore,
} from './in-memory-workspace-repositories.js';
import { Workspace } from './workspace.js';
import { WorkspaceInvitation } from './workspace-invitation.js';
import { WorkspaceMember } from './workspace-member.js';
import type { WorkspaceRole } from './permissions.js';

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INVITEE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const EXISTING_MEMBER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('AcceptWorkspaceInvitation', () => {
  let workspaces: InMemoryWorkspaceRepository;
  let members: InMemoryWorkspaceMemberRepository;
  let invitations: InMemoryWorkspaceInvitationRepository;
  let users: InMemoryUserRepository;
  let tokens: FakeTokenService;
  let acceptStore: MemoryAcceptStore;
  let audit: InMemoryAuditLogger;
  let useCase: AcceptWorkspaceInvitation;

  beforeEach(async () => {
    workspaces = new InMemoryWorkspaceRepository();
    members = new InMemoryWorkspaceMemberRepository();
    invitations = new InMemoryWorkspaceInvitationRepository();
    users = new InMemoryUserRepository();
    tokens = new FakeTokenService();
    acceptStore = new MemoryAcceptStore(invitations, members);
    audit = new InMemoryAuditLogger();

    await workspaces.save(
      Workspace.create({
        id: WORKSPACE_ID,
        name: 'Planejamento Familiar',
        createdByUserId: OWNER_ID,
      }),
    );

    await users.save(
      User.create({
        id: OWNER_ID,
        name: 'Owner User',
        email: 'owner@example.com',
        passwordHash: 'hash',
      }),
    );
    await users.save(
      User.create({
        id: INVITEE_ID,
        name: 'Invitee User',
        email: 'invitee@example.com',
        passwordHash: 'hash',
      }),
    );
    await users.save(
      User.create({
        id: OTHER_USER_ID,
        name: 'Other User',
        email: 'other@example.com',
        passwordHash: 'hash',
      }),
    );

    members.seedMember(
      WorkspaceMember.create({
        id: 'owner-membership',
        workspaceId: WORKSPACE_ID,
        userId: OWNER_ID,
        role: 'owner',
      }),
      { id: OWNER_ID, name: 'Owner User', email: 'owner@example.com' },
    );

    useCase = new AcceptWorkspaceInvitation(
      invitations,
      members,
      workspaces,
      users,
      tokens,
      acceptStore,
      audit,
    );
  });

  async function seedInvitation(input: {
    email: string;
    role?: WorkspaceRole;
    expiresAt?: Date;
    token?: string;
    status?: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
    id?: string;
  }): Promise<{ invitation: WorkspaceInvitation; rawToken: string }> {
    const rawToken = input.token ?? tokens.generateOpaqueToken();
    const tokenHash = tokens.hashRefreshToken(rawToken);
    const now = new Date();
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let invitation = WorkspaceInvitation.create({
      id: input.id ?? randomUUID(),
      workspaceId: WORKSPACE_ID,
      email: input.email,
      role: input.role ?? 'member',
      tokenHash,
      invitedByUserId: OWNER_ID,
      expiresAt,
      now,
    });

    if (input.status === 'accepted') {
      invitation.accept(INVITEE_ID, invitation.normalizedEmail, now);
    } else if (input.status === 'declined') {
      invitation.decline(invitation.normalizedEmail, now);
    } else if (input.status === 'revoked') {
      invitation.revoke(now);
    } else if (input.status === 'expired') {
      invitation = WorkspaceInvitation.reconstitute({
        ...invitation.toProps(),
        expiresAt: new Date(now.getTime() - 60_000),
      });
    }

    await invitations.save(invitation);
    return { invitation, rawToken };
  }

  it('aceita convite válido e cria membership', async () => {
    const { rawToken } = await seedInvitation({ email: 'invitee@example.com' });

    const result = await useCase.execute({ token: rawToken, userId: INVITEE_ID });

    expect(result.workspaceId).toBe(WORKSPACE_ID);
    expect(result.membership.role).toBe('member');
    expect(result.membership.isActive).toBe(true);

    const stored = await members.findActiveByWorkspaceAndUser(WORKSPACE_ID, INVITEE_ID);
    expect(stored?.id).toBe(result.membership.id);

    const storedInvitation = await invitations.findByTokenHash(tokens.hashRefreshToken(rawToken));
    expect(storedInvitation?.status()).toBe('accepted');
    expect(audit.events.some((event) => event.name === 'InvitationAccepted')).toBe(true);
    expect(audit.events.some((event) => event.name === 'MembershipCreated')).toBe(true);
  });

  it('exige e-mail do usuário compatível com o convite', async () => {
    const { rawToken } = await seedInvitation({ email: 'invitee@example.com' });

    await expect(useCase.execute({ token: rawToken, userId: OTHER_USER_ID })).rejects.toMatchObject(
      {
        code: 'INVITATION_EMAIL_MISMATCH',
      } satisfies Partial<DomainError>,
    );
  });

  it('rejeita convite expirado', async () => {
    const { rawToken } = await seedInvitation({
      email: 'invitee@example.com',
      status: 'expired',
    });

    await expect(useCase.execute({ token: rawToken, userId: INVITEE_ID })).rejects.toMatchObject({
      code: 'INVITATION_EXPIRED',
    } satisfies Partial<DomainError>);
  });

  it('rejeita convite revogado', async () => {
    const { rawToken } = await seedInvitation({
      email: 'invitee@example.com',
      status: 'revoked',
    });

    await expect(useCase.execute({ token: rawToken, userId: INVITEE_ID })).rejects.toMatchObject({
      code: 'INVITATION_REVOKED',
    } satisfies Partial<DomainError>);
  });

  it('rejeita convite recusado', async () => {
    const { rawToken } = await seedInvitation({
      email: 'invitee@example.com',
      status: 'declined',
    });

    await expect(useCase.execute({ token: rawToken, userId: INVITEE_ID })).rejects.toMatchObject({
      code: 'INVITATION_DECLINED',
    } satisfies Partial<DomainError>);
  });

  it('rejeita convite já aceito', async () => {
    const { rawToken } = await seedInvitation({
      email: 'invitee@example.com',
      status: 'accepted',
    });

    await expect(useCase.execute({ token: rawToken, userId: INVITEE_ID })).rejects.toMatchObject({
      code: 'INVITATION_ALREADY_ACCEPTED',
    } satisfies Partial<DomainError>);
  });

  it('persiste aceite de forma atômica via accept store', async () => {
    const { rawToken } = await seedInvitation({ email: 'invitee@example.com' });

    await useCase.execute({ token: rawToken, userId: INVITEE_ID });

    expect(acceptStore.calls).toHaveLength(1);
    expect(acceptStore.calls[0]?.invitation.status()).toBe('accepted');
    expect(acceptStore.calls[0]?.membership.userId).toBe(INVITEE_ID);
  });

  it('é idempotente quando usuário já é membro ativo', async () => {
    const existingMembership = WorkspaceMember.create({
      id: EXISTING_MEMBER_ID,
      workspaceId: WORKSPACE_ID,
      userId: INVITEE_ID,
      role: 'viewer',
    });
    members.seedMember(existingMembership, {
      id: INVITEE_ID,
      name: 'Invitee User',
      email: 'invitee@example.com',
    });

    const { rawToken } = await seedInvitation({ email: 'invitee@example.com', role: 'member' });

    const result = await useCase.execute({ token: rawToken, userId: INVITEE_ID });

    expect(result.membership.id).toBe(EXISTING_MEMBER_ID);
    expect(result.membership.role).toBe('viewer');
    expect(acceptStore.calls).toHaveLength(0);

    const storedInvitation = await invitations.findByTokenHash(tokens.hashRefreshToken(rawToken));
    expect(storedInvitation?.status()).toBe('accepted');
  });

  it('rejeita token inválido', async () => {
    await expect(
      useCase.execute({ token: 'token-invalido', userId: INVITEE_ID }),
    ).rejects.toMatchObject({
      code: 'INVITATION_NOT_FOUND',
    } satisfies Partial<DomainError>);
  });

  it('permite múltiplos owners via convite', async () => {
    const { rawToken } = await seedInvitation({
      email: 'invitee@example.com',
      role: 'owner',
    });

    const result = await useCase.execute({ token: rawToken, userId: INVITEE_ID });

    expect(result.membership.role).toBe('owner');
    expect(await members.countActiveOwners(WORKSPACE_ID)).toBe(2);
    expect(audit.events.some((event) => event.name === 'OwnerAdded')).toBe(true);
  });
});
