import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { WorkspaceAuthorizationPolicy } from './authorization-policy.js';
import type { WorkspaceRole } from './permissions.js';
import type { WorkspaceMemberRepository } from './repositories.js';

export class ChangeMemberRole {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly policy = new WorkspaceAuthorizationPolicy(),
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    workspaceId: string;
    actorUserId: string;
    actorRole: WorkspaceRole;
    membershipId: string;
    nextRole: WorkspaceRole;
  }) {
    const member = await this.members.findById(input.membershipId);
    if (!member || member.workspaceId !== input.workspaceId || !member.isActive) {
      throw new DomainError('MEMBER_NOT_FOUND', 'Membro não encontrado.');
    }

    const activeOwnerCount = await this.members.countActiveOwners(input.workspaceId);

    this.policy.assertCanChangeRole({
      actorRole: input.actorRole,
      currentRole: member.role,
      nextRole: input.nextRole,
      activeOwnerCount,
    });

    const previousRole = member.role;
    member.changeRole(input.nextRole);
    await this.members.save(member);

    await this.audit?.record({
      name: 'MembershipRoleChanged',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        membershipId: member.id,
        previousRole,
        nextRole: input.nextRole,
      },
    });

    if (input.nextRole === 'owner' && previousRole !== 'owner') {
      await this.audit?.record({
        name: 'OwnerAdded',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        occurredAt: new Date(),
        payload: { membershipId: member.id },
      });
    }

    return member;
  }
}

export class DeactivateMember {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly policy = new WorkspaceAuthorizationPolicy(),
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    workspaceId: string;
    actorUserId: string;
    actorRole: WorkspaceRole;
    membershipId: string;
  }) {
    const member = await this.members.findById(input.membershipId);
    if (!member || member.workspaceId !== input.workspaceId || !member.isActive) {
      throw new DomainError('MEMBER_NOT_FOUND', 'Membro não encontrado.');
    }

    const activeOwnerCount = await this.members.countActiveOwners(input.workspaceId);

    this.policy.assertCanDeactivateMember({
      actorRole: input.actorRole,
      targetRole: member.role,
      targetUserId: member.userId,
      actorUserId: input.actorUserId,
      activeOwnerCount,
    });

    member.deactivate();
    await this.members.save(member);

    await this.audit?.record({
      name: 'MembershipDeactivated',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: { membershipId: member.id, role: member.role },
    });

    return member;
  }
}

export class LeaveWorkspace {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly policy = new WorkspaceAuthorizationPolicy(),
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: { workspaceId: string; userId: string }) {
    const member = await this.members.findActiveByWorkspaceAndUser(input.workspaceId, input.userId);

    if (!member) {
      throw new DomainError('MEMBER_NOT_FOUND', 'Membro não encontrado.');
    }

    const activeOwnerCount = await this.members.countActiveOwners(input.workspaceId);

    this.policy.assertCanDeactivateMember({
      actorRole: member.role,
      targetRole: member.role,
      targetUserId: member.userId,
      actorUserId: input.userId,
      activeOwnerCount,
      isSelfLeave: true,
    });

    member.deactivate();
    await this.members.save(member);

    await this.audit?.record({
      name: 'MemberLeftWorkspace',
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: { membershipId: member.id },
    });

    return member;
  }
}
