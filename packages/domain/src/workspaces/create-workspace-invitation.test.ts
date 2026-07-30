import { describe, expect, it, beforeEach } from 'vitest';
import type { DomainError } from '../shared/domain-error.js';
import { InMemoryAuditLogger } from '../shared/audit.js';
import { CreateWorkspaceInvitation } from './invitation-use-cases.js';
import {
  FakeTokenService,
  InMemoryWorkspaceInvitationRepository,
  InMemoryWorkspaceMemberRepository,
  InMemoryWorkspaceRepository,
} from './in-memory-workspace-repositories.js';
import { Workspace } from './workspace.js';
import { WorkspaceMember } from './workspace-member.js';
import type { WorkspaceRole } from './permissions.js';

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MEMBER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const VIEWER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const EXISTING_MEMBER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const APP_BASE_URL = 'https://app.example.com';

describe('CreateWorkspaceInvitation', () => {
  let workspaces: InMemoryWorkspaceRepository;
  let members: InMemoryWorkspaceMemberRepository;
  let invitations: InMemoryWorkspaceInvitationRepository;
  let tokens: FakeTokenService;
  let audit: InMemoryAuditLogger;
  let useCase: CreateWorkspaceInvitation;

  beforeEach(() => {
    workspaces = new InMemoryWorkspaceRepository();
    members = new InMemoryWorkspaceMemberRepository();
    invitations = new InMemoryWorkspaceInvitationRepository();
    tokens = new FakeTokenService();
    audit = new InMemoryAuditLogger();

    const workspace = Workspace.create({
      id: WORKSPACE_ID,
      name: 'Planejamento Familiar',
      createdByUserId: OWNER_ID,
    });
    workspaces.save(workspace);

    seedMember(OWNER_ID, 'owner-id', 'owner', 'owner@example.com');
    seedMember(ADMIN_ID, 'admin-id', 'admin', 'admin@example.com');
    seedMember(MEMBER_ID, 'member-id', 'member', 'member@example.com');
    seedMember(VIEWER_ID, 'viewer-id', 'viewer', 'viewer@example.com');
    seedMember(EXISTING_MEMBER_ID, 'existing-id', 'member', 'existing@example.com');

    useCase = new CreateWorkspaceInvitation(
      workspaces,
      members,
      invitations,
      tokens,
      undefined,
      audit,
    );
  });

  function seedMember(
    userId: string,
    membershipId: string,
    role: WorkspaceRole,
    email: string,
  ): void {
    members.seedMember(
      WorkspaceMember.create({
        id: membershipId,
        workspaceId: WORKSPACE_ID,
        userId,
        role,
      }),
      { id: userId, name: role, email },
    );
  }

  async function inviteAs(
    actorUserId: string,
    actorRole: WorkspaceRole,
    email: string,
    role: WorkspaceRole,
  ) {
    return useCase.execute({
      workspaceId: WORKSPACE_ID,
      actorUserId,
      actorRole,
      email,
      role,
      appBaseUrl: APP_BASE_URL,
    });
  }

  it('owner convida member', async () => {
    const result = await inviteAs(OWNER_ID, 'owner', 'novo@example.com', 'member');

    expect(result.invitation.role).toBe('member');
    expect(result.invitation.normalizedEmail).toBe('novo@example.com');
    expect(result.invitationLink).toBe(`${APP_BASE_URL}/convites/${result.rawToken}`);
    expect(audit.events.some((event) => event.name === 'InvitationCreated')).toBe(true);
  });

  it('owner convida outro owner', async () => {
    const result = await inviteAs(OWNER_ID, 'owner', 'coowner@example.com', 'owner');

    expect(result.invitation.role).toBe('owner');
  });

  it('admin convida member', async () => {
    const result = await inviteAs(ADMIN_ID, 'admin', 'colaborador@example.com', 'member');

    expect(result.invitation.role).toBe('member');
  });

  it('admin convida viewer', async () => {
    const result = await inviteAs(ADMIN_ID, 'admin', 'leitor@example.com', 'viewer');

    expect(result.invitation.role).toBe('viewer');
  });

  it('admin não convida owner', async () => {
    await expect(inviteAs(ADMIN_ID, 'admin', 'owner2@example.com', 'owner')).rejects.toMatchObject({
      code: 'INVITATION_ROLE_NOT_ALLOWED',
    } satisfies Partial<DomainError>);
  });

  it('member não convida', async () => {
    await expect(
      inviteAs(MEMBER_ID, 'member', 'convidado@example.com', 'viewer'),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_PERMISSION',
    } satisfies Partial<DomainError>);
  });

  it('viewer não convida', async () => {
    await expect(
      inviteAs(VIEWER_ID, 'viewer', 'convidado@example.com', 'member'),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_PERMISSION',
    } satisfies Partial<DomainError>);
  });

  it('normaliza e-mail do convite', async () => {
    const result = await inviteAs(OWNER_ID, 'owner', '  Novo@Example.COM  ', 'member');

    expect(result.invitation.invitedEmail).toBe('novo@example.com');
    expect(result.invitation.normalizedEmail).toBe('novo@example.com');
  });

  it('rejeita e-mail que já é membro ativo', async () => {
    await expect(
      inviteAs(OWNER_ID, 'owner', 'Existing@Example.com', 'viewer'),
    ).rejects.toMatchObject({
      code: 'MEMBER_ALREADY_EXISTS',
    } satisfies Partial<DomainError>);
  });

  it('reenvio revoga convite pendente anterior', async () => {
    const first = await inviteAs(OWNER_ID, 'owner', 'reenvio@example.com', 'member');
    const second = await inviteAs(OWNER_ID, 'owner', 'Reenvio@Example.com', 'viewer');

    const firstStored = await invitations.findById(first.invitation.id);
    const secondStored = await invitations.findById(second.invitation.id);

    expect(firstStored?.status()).toBe('revoked');
    expect(secondStored?.status()).toBe('pending');
    expect(second.invitation.role).toBe('viewer');
    expect(first.rawToken).not.toBe(second.rawToken);
  });

  it('persiste apenas hash do token, nunca o token bruto', async () => {
    const result = await inviteAs(OWNER_ID, 'owner', 'seguro@example.com', 'member');
    const stored = await invitations.findById(result.invitation.id);

    expect(stored?.tokenHash).toBe(tokens.hashRefreshToken(result.rawToken));
    expect(stored?.tokenHash).not.toBe(result.rawToken);

    for (const invitation of invitations.items.values()) {
      expect(invitation.tokenHash.startsWith('sha:')).toBe(true);
      expect(invitation.tokenHash).not.toBe(result.rawToken);
    }
  });

  it('rejeita workspace inativo', async () => {
    const inactiveWorkspace = Workspace.reconstitute({
      ...Workspace.create({
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Workspace Inativo',
        createdByUserId: OWNER_ID,
      }).toProps(),
      isActive: false,
    });
    await workspaces.save(inactiveWorkspace);

    await expect(
      useCase.execute({
        workspaceId: inactiveWorkspace.id,
        actorUserId: OWNER_ID,
        actorRole: 'owner',
        email: 'novo@example.com',
        role: 'member',
        appBaseUrl: APP_BASE_URL,
      }),
    ).rejects.toMatchObject({
      code: 'WORKSPACE_INACTIVE',
    } satisfies Partial<DomainError>);
  });
});
