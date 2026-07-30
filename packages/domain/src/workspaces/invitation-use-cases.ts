import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { Email } from '../identity/email.js';
import type { TokenService } from '../identity/ports.js';
import type { UserRepository } from '../identity/user-repository.js';
import { WorkspaceAuthorizationPolicy } from './authorization-policy.js';
import { WorkspaceInvitation } from './workspace-invitation.js';
import { WorkspaceMember } from './workspace-member.js';
import type { WorkspaceRole } from './permissions.js';
import type {
  WorkspaceInvitationRepository,
  WorkspaceMemberRepository,
  WorkspaceRepository,
} from './repositories.js';

const INVITATION_TTL_DAYS = 7;

export class CreateWorkspaceInvitation {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly tokens: TokenService,
    private readonly policy = new WorkspaceAuthorizationPolicy(),
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    workspaceId: string;
    actorUserId: string;
    actorRole: WorkspaceRole;
    email: string;
    role: WorkspaceRole;
    appBaseUrl: string;
  }): Promise<{ invitation: WorkspaceInvitation; invitationLink: string; rawToken: string }> {
    this.policy.assertCanInviteRole(input.actorRole, input.role);

    const workspace = await this.workspaces.findById(input.workspaceId);
    if (!workspace) {
      throw new DomainError('WORKSPACE_ACCESS_DENIED', 'Workspace não encontrado.');
    }
    workspace.assertActive();

    const email = Email.create(input.email);
    const members = await this.members.listActiveByWorkspace(input.workspaceId);
    if (members.some((item) => item.user.email.toLowerCase() === email.normalized)) {
      throw new DomainError(
        'MEMBER_ALREADY_EXISTS',
        'Este e-mail já possui membership neste workspace.',
      );
    }

    const pending = await this.invitations.findPendingByWorkspaceAndEmail(
      input.workspaceId,
      email.normalized,
    );

    const rawToken = this.tokens.generateOpaqueToken();
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = WorkspaceInvitation.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      email: email.value,
      role: input.role,
      tokenHash,
      invitedByUserId: input.actorUserId,
      expiresAt,
    });

    if (pending) {
      pending.revoke();
    }

    await this.invitations.revokePendingAndCreate({
      previous: pending,
      next: invitation,
    });

    await this.audit?.record({
      name: 'InvitationCreated',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        invitationId: invitation.id,
        role: invitation.role,
        email: invitation.normalizedEmail,
      },
    });

    return {
      invitation,
      rawToken,
      invitationLink: `${input.appBaseUrl.replace(/\/$/, '')}/convites/${rawToken}`,
    };
  }
}

export class AcceptWorkspaceInvitation {
  constructor(
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly acceptStore: {
      accept(input: {
        invitation: WorkspaceInvitation;
        membership: WorkspaceMember;
      }): Promise<void>;
    },
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    token: string;
    userId: string;
  }): Promise<{ membership: WorkspaceMember; workspaceId: string }> {
    const hash = this.tokens.hashRefreshToken(input.token);
    const invitation = await this.invitations.findByTokenHash(hash);

    if (!invitation) {
      throw new DomainError('INVITATION_NOT_FOUND', 'Convite não encontrado.');
    }

    const user = await this.users.findById(input.userId);
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE', 'Usuário inativo.');
    }

    const workspace = await this.workspaces.findById(invitation.workspaceId);
    if (!workspace) {
      throw new DomainError('WORKSPACE_ACCESS_DENIED', 'Workspace não encontrado.');
    }
    workspace.assertActive();

    const existing = await this.members.findByWorkspaceAndUser(
      invitation.workspaceId,
      user.id,
    );

    if (existing?.isActive) {
      if (invitation.status() === 'pending') {
        invitation.accept(user.id, user.normalizedEmail);
        await this.invitations.save(invitation);
      }

      return { membership: existing, workspaceId: invitation.workspaceId };
    }

    invitation.accept(user.id, user.normalizedEmail);

    const membership = WorkspaceMember.create({
      id: existing?.id ?? randomUUID(),
      workspaceId: invitation.workspaceId,
      userId: user.id,
      role: invitation.role,
    });

    await this.acceptStore.accept({ invitation, membership });

    await this.audit?.record({
      name: 'InvitationAccepted',
      actorUserId: user.id,
      workspaceId: invitation.workspaceId,
      occurredAt: new Date(),
      payload: {
        invitationId: invitation.id,
        membershipId: membership.id,
        role: membership.role,
      },
    });

    await this.audit?.record({
      name: 'MembershipCreated',
      actorUserId: user.id,
      workspaceId: invitation.workspaceId,
      occurredAt: new Date(),
      payload: {
        membershipId: membership.id,
        role: membership.role,
      },
    });

    if (membership.role === 'owner') {
      await this.audit?.record({
        name: 'OwnerAdded',
        actorUserId: user.id,
        workspaceId: invitation.workspaceId,
        occurredAt: new Date(),
        payload: { membershipId: membership.id },
      });
    }

    return { membership, workspaceId: invitation.workspaceId };
  }
}

export class DeclineWorkspaceInvitation {
  constructor(
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: { token: string; userId: string }): Promise<void> {
    const hash = this.tokens.hashRefreshToken(input.token);
    const invitation = await this.invitations.findByTokenHash(hash);

    if (!invitation) {
      throw new DomainError('INVITATION_NOT_FOUND', 'Convite não encontrado.');
    }

    const user = await this.users.findById(input.userId);
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE', 'Usuário inativo.');
    }

    invitation.decline(user.normalizedEmail);
    await this.invitations.save(invitation);

    await this.audit?.record({
      name: 'InvitationDeclined',
      actorUserId: user.id,
      workspaceId: invitation.workspaceId,
      occurredAt: new Date(),
      payload: { invitationId: invitation.id },
    });
  }
}

export class RevokeWorkspaceInvitation {
  constructor(
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    invitationId: string;
    workspaceId: string;
    actorUserId: string;
  }): Promise<void> {
    const invitation = await this.invitations.findById(input.invitationId);

    if (!invitation || invitation.workspaceId !== input.workspaceId) {
      throw new DomainError('INVITATION_NOT_FOUND', 'Convite não encontrado.');
    }

    invitation.revoke();
    await this.invitations.save(invitation);

    await this.audit?.record({
      name: 'InvitationRevoked',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: { invitationId: invitation.id },
    });
  }
}

export class GetInvitationPreview {
  constructor(
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(token: string) {
    const hash = this.tokens.hashRefreshToken(token);
    const invitation = await this.invitations.findByTokenHash(hash);

    if (!invitation) {
      throw new DomainError('INVITATION_NOT_FOUND', 'Convite não encontrado.');
    }

    const workspace = await this.workspaces.findById(invitation.workspaceId);
    const inviter = await this.users.findById(invitation.invitedByUserId);

    return {
      invitation,
      workspaceName: workspace?.name ?? 'Workspace',
      invitedByName: inviter?.name ?? 'Usuário',
    };
  }
}
