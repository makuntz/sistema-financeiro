import { DomainError } from '../shared/domain-error.js';
import { Email } from '../identity/email.js';
import type { WorkspaceRole } from './permissions.js';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export type WorkspaceInvitationProps = {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  normalizedEmail: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  declinedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class WorkspaceInvitation {
  private constructor(private props: WorkspaceInvitationProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    tokenHash: string;
    invitedByUserId: string;
    expiresAt: Date;
    now?: Date;
  }): WorkspaceInvitation {
    const email = Email.create(input.email);
    const now = input.now ?? new Date();

    return new WorkspaceInvitation({
      id: input.id,
      workspaceId: input.workspaceId,
      invitedEmail: email.value,
      normalizedEmail: email.normalized,
      role: input.role,
      tokenHash: input.tokenHash,
      invitedByUserId: input.invitedByUserId,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      acceptedByUserId: null,
      declinedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: WorkspaceInvitationProps): WorkspaceInvitation {
    return new WorkspaceInvitation(props);
  }

  get id(): string {
    return this.props.id;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get invitedEmail(): string {
    return this.props.invitedEmail;
  }

  get normalizedEmail(): string {
    return this.props.normalizedEmail;
  }

  get role(): WorkspaceRole {
    return this.props.role;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get invitedByUserId(): string {
    return this.props.invitedByUserId;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get acceptedAt(): Date | null {
    return this.props.acceptedAt;
  }

  get acceptedByUserId(): string | null {
    return this.props.acceptedByUserId;
  }

  get declinedAt(): Date | null {
    return this.props.declinedAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  status(now: Date = new Date()): InvitationStatus {
    if (this.props.acceptedAt) {
      return 'accepted';
    }

    if (this.props.declinedAt) {
      return 'declined';
    }

    if (this.props.revokedAt) {
      return 'revoked';
    }

    if (this.props.expiresAt.getTime() <= now.getTime()) {
      return 'expired';
    }

    return 'pending';
  }

  assertAcceptable(now: Date = new Date()): void {
    const status = this.status(now);

    if (status === 'accepted') {
      throw new DomainError('INVITATION_ALREADY_ACCEPTED', 'Este convite já foi aceito.');
    }

    if (status === 'declined') {
      throw new DomainError('INVITATION_DECLINED', 'Este convite foi recusado.');
    }

    if (status === 'revoked') {
      throw new DomainError('INVITATION_REVOKED', 'Este convite foi revogado.');
    }

    if (status === 'expired') {
      throw new DomainError('INVITATION_EXPIRED', 'Este convite expirou.');
    }
  }

  accept(userId: string, normalizedEmail: string, now: Date = new Date()): void {
    this.assertAcceptable(now);

    if (this.props.normalizedEmail !== normalizedEmail) {
      throw new DomainError(
        'INVITATION_EMAIL_MISMATCH',
        'Este convite foi enviado para outro endereço de e-mail.',
      );
    }

    this.props = {
      ...this.props,
      acceptedAt: now,
      acceptedByUserId: userId,
      updatedAt: now,
    };
  }

  decline(normalizedEmail: string, now: Date = new Date()): void {
    this.assertAcceptable(now);

    if (this.props.normalizedEmail !== normalizedEmail) {
      throw new DomainError(
        'INVITATION_EMAIL_MISMATCH',
        'Este convite foi enviado para outro endereço de e-mail.',
      );
    }

    this.props = {
      ...this.props,
      declinedAt: now,
      updatedAt: now,
    };
  }

  revoke(now: Date = new Date()): void {
    if (this.status(now) !== 'pending' && this.status(now) !== 'expired') {
      return;
    }

    this.props = {
      ...this.props,
      revokedAt: now,
      updatedAt: now,
    };
  }

  toProps(): WorkspaceInvitationProps {
    return { ...this.props };
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return '***';
  }

  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
