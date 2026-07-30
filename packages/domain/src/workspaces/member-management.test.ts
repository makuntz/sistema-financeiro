import { describe, expect, it, beforeEach } from 'vitest';
import type { DomainError } from '../shared/domain-error.js';
import { InMemoryAuditLogger } from '../shared/audit.js';
import {
  ChangeMemberRole,
  DeactivateMember,
  LeaveWorkspace,
} from './member-use-cases.js';
import { InMemoryWorkspaceMemberRepository } from './in-memory-workspace-repositories.js';
import { WorkspaceMember } from './workspace-member.js';

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWNER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ADMIN_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const MEMBER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('ChangeMemberRole', () => {
  let members: InMemoryWorkspaceMemberRepository;
  let audit: InMemoryAuditLogger;
  let useCase: ChangeMemberRole;

  beforeEach(() => {
    members = new InMemoryWorkspaceMemberRepository();
    audit = new InMemoryAuditLogger();
    useCase = new ChangeMemberRole(members, undefined, audit);

    seedMember('owner-a-membership', OWNER_A_ID, 'owner');
    seedMember('owner-b-membership', OWNER_B_ID, 'owner');
    seedMember('admin-membership', ADMIN_ID, 'admin');
    seedMember('member-membership', MEMBER_ID, 'member');
  });

  function seedMember(membershipId: string, userId: string, role: 'owner' | 'admin' | 'member') {
    members.seedMember(
      WorkspaceMember.create({
        id: membershipId,
        workspaceId: WORKSPACE_ID,
        userId,
        role,
      }),
      { id: userId, name: role, email: `${role}@example.com` },
    );
  }

  it('owner promove member para owner', async () => {
    const updated = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_A_ID,
      actorRole: 'owner',
      membershipId: 'member-membership',
      nextRole: 'owner',
    });

    expect(updated.role).toBe('owner');
    expect(await members.countActiveOwners(WORKSPACE_ID)).toBe(3);
    expect(audit.events.some((event) => event.name === 'OwnerAdded')).toBe(true);
  });

  it('admin não promove member para owner', async () => {
    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        actorUserId: ADMIN_ID,
        actorRole: 'admin',
        membershipId: 'member-membership',
        nextRole: 'owner',
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_PERMISSION',
    } satisfies Partial<DomainError>);
  });

  it('não rebaixa o último owner', async () => {
    await members.save(
      WorkspaceMember.reconstitute({
        ...WorkspaceMember.create({
          id: 'owner-b-membership',
          workspaceId: WORKSPACE_ID,
          userId: OWNER_B_ID,
          role: 'owner',
        }).toProps(),
        isActive: false,
      }),
    );

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_A_ID,
        actorRole: 'owner',
        membershipId: 'owner-a-membership',
        nextRole: 'admin',
      }),
    ).rejects.toMatchObject({
      code: 'LAST_OWNER_REQUIRED',
    } satisfies Partial<DomainError>);
  });
});

describe('DeactivateMember', () => {
  let members: InMemoryWorkspaceMemberRepository;
  let audit: InMemoryAuditLogger;
  let useCase: DeactivateMember;

  beforeEach(() => {
    members = new InMemoryWorkspaceMemberRepository();
    audit = new InMemoryAuditLogger();
    useCase = new DeactivateMember(members, undefined, audit);

    members.seedMember(
      WorkspaceMember.create({
        id: 'owner-a-membership',
        workspaceId: WORKSPACE_ID,
        userId: OWNER_A_ID,
        role: 'owner',
      }),
      { id: OWNER_A_ID, name: 'Owner A', email: 'owner-a@example.com' },
    );
    members.seedMember(
      WorkspaceMember.create({
        id: 'owner-b-membership',
        workspaceId: WORKSPACE_ID,
        userId: OWNER_B_ID,
        role: 'owner',
      }),
      { id: OWNER_B_ID, name: 'Owner B', email: 'owner-b@example.com' },
    );
    members.seedMember(
      WorkspaceMember.create({
        id: 'member-membership',
        workspaceId: WORKSPACE_ID,
        userId: MEMBER_ID,
        role: 'member',
      }),
      { id: MEMBER_ID, name: 'Member', email: 'member@example.com' },
    );
  });

  it('não remove o último owner', async () => {
    await members.save(
      WorkspaceMember.reconstitute({
        ...WorkspaceMember.create({
          id: 'owner-b-membership',
          workspaceId: WORKSPACE_ID,
          userId: OWNER_B_ID,
          role: 'owner',
        }).toProps(),
        isActive: false,
      }),
    );

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_A_ID,
        actorRole: 'owner',
        membershipId: 'owner-a-membership',
      }),
    ).rejects.toMatchObject({
      code: 'LAST_OWNER_REQUIRED',
    } satisfies Partial<DomainError>);
  });

  it('desativação preserva membership histórico com isActive=false', async () => {
    const deactivated = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_A_ID,
      actorRole: 'owner',
      membershipId: 'member-membership',
    });

    expect(deactivated.isActive).toBe(false);

    const stored = await members.findById('member-membership');
    expect(stored?.isActive).toBe(false);
    expect(stored?.role).toBe('member');
    expect(stored?.userId).toBe(MEMBER_ID);

    const active = await members.findActiveByWorkspaceAndUser(WORKSPACE_ID, MEMBER_ID);
    expect(active).toBeNull();

    expect(audit.events.some((event) => event.name === 'MembershipDeactivated')).toBe(true);
  });
});

describe('LeaveWorkspace', () => {
  let members: InMemoryWorkspaceMemberRepository;
  let audit: InMemoryAuditLogger;
  let useCase: LeaveWorkspace;

  beforeEach(() => {
    members = new InMemoryWorkspaceMemberRepository();
    audit = new InMemoryAuditLogger();
    useCase = new LeaveWorkspace(members, undefined, audit);
  });

  function seedOwner(membershipId: string, userId: string) {
    members.seedMember(
      WorkspaceMember.create({
        id: membershipId,
        workspaceId: WORKSPACE_ID,
        userId,
        role: 'owner',
      }),
      { id: userId, name: 'Owner', email: `${userId.slice(0, 8)}@example.com` },
    );
  }

  it('owner pode sair quando existe outro owner', async () => {
    seedOwner('owner-a-membership', OWNER_A_ID);
    seedOwner('owner-b-membership', OWNER_B_ID);

    const left = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      userId: OWNER_A_ID,
    });

    expect(left.isActive).toBe(false);
    expect(await members.countActiveOwners(WORKSPACE_ID)).toBe(1);
    expect(audit.events.some((event) => event.name === 'MemberLeftWorkspace')).toBe(true);
  });

  it('owner não pode sair sendo o único owner', async () => {
    seedOwner('owner-a-membership', OWNER_A_ID);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        userId: OWNER_A_ID,
      }),
    ).rejects.toMatchObject({
      code: 'LAST_OWNER_REQUIRED',
    } satisfies Partial<DomainError>);

    const stored = await members.findById('owner-a-membership');
    expect(stored?.isActive).toBe(true);
  });
});
