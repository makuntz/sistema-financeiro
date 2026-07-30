import { DomainError } from '../shared/domain-error.js';
import { roleHasPermission, type Permission, type WorkspaceRole } from './permissions.js';

export class WorkspaceAuthorizationPolicy {
  hasPermission(role: WorkspaceRole, permission: Permission): boolean {
    return roleHasPermission(role, permission);
  }

  assertPermission(role: WorkspaceRole, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      throw new DomainError(
        'INSUFFICIENT_PERMISSION',
        'Você não possui permissão para esta ação.',
        { role, permission },
      );
    }
  }

  canInviteRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
    if (actorRole === 'owner') {
      return true;
    }

    if (actorRole === 'admin') {
      return targetRole === 'member' || targetRole === 'viewer';
    }

    return false;
  }

  assertCanInviteRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): void {
    this.assertPermission(actorRole, 'invitations.create');

    if (!this.canInviteRole(actorRole, targetRole)) {
      throw new DomainError(
        'INVITATION_ROLE_NOT_ALLOWED',
        'Você não pode convidar alguém com este papel.',
        { actorRole, targetRole },
      );
    }
  }

  canChangeRole(input: {
    actorRole: WorkspaceRole;
    currentRole: WorkspaceRole;
    nextRole: WorkspaceRole;
    activeOwnerCount: number;
  }): boolean {
    const { actorRole, currentRole, nextRole, activeOwnerCount } = input;

    if (!this.hasPermission(actorRole, 'members.manage')) {
      return false;
    }

    if (actorRole === 'admin') {
      if (currentRole === 'owner' || nextRole === 'owner') {
        return false;
      }
    }

    if (currentRole === 'owner' && nextRole !== 'owner' && activeOwnerCount <= 1) {
      return false;
    }

    return true;
  }

  assertCanChangeRole(input: {
    actorRole: WorkspaceRole;
    currentRole: WorkspaceRole;
    nextRole: WorkspaceRole;
    activeOwnerCount: number;
  }): void {
    this.assertPermission(input.actorRole, 'members.manage');

    if (input.actorRole === 'admin') {
      if (input.currentRole === 'owner' || input.nextRole === 'owner') {
        throw new DomainError(
          'INSUFFICIENT_PERMISSION',
          'Administradores não podem alterar papéis de owner.',
        );
      }
    }

    if (
      input.currentRole === 'owner' &&
      input.nextRole !== 'owner' &&
      input.activeOwnerCount <= 1
    ) {
      throw new DomainError(
        'LAST_OWNER_REQUIRED',
        'O workspace deve manter pelo menos um owner ativo.',
      );
    }
  }

  canDeactivateMember(input: {
    actorRole: WorkspaceRole;
    targetRole: WorkspaceRole;
    targetUserId: string;
    actorUserId: string;
    activeOwnerCount: number;
    isSelfLeave?: boolean;
  }): boolean {
    const { actorRole, targetRole, activeOwnerCount, isSelfLeave } = input;

    if (isSelfLeave) {
      return !(targetRole === 'owner' && activeOwnerCount <= 1);
    }

    if (!this.hasPermission(actorRole, 'members.manage')) {
      return false;
    }

    if (actorRole === 'admin' && targetRole === 'owner') {
      return false;
    }

    if (targetRole === 'owner' && activeOwnerCount <= 1) {
      return false;
    }

    return true;
  }

  assertCanDeactivateMember(input: {
    actorRole: WorkspaceRole;
    targetRole: WorkspaceRole;
    targetUserId: string;
    actorUserId: string;
    activeOwnerCount: number;
    isSelfLeave?: boolean;
  }): void {
    if (input.isSelfLeave) {
      if (input.targetRole === 'owner' && input.activeOwnerCount <= 1) {
        throw new DomainError('LAST_OWNER_REQUIRED', 'O último owner não pode sair do workspace.');
      }
      return;
    }

    this.assertPermission(input.actorRole, 'members.manage');

    if (input.actorRole === 'admin' && input.targetRole === 'owner') {
      throw new DomainError('INSUFFICIENT_PERMISSION', 'Administradores não podem remover owners.');
    }

    if (input.targetRole === 'owner' && input.activeOwnerCount <= 1) {
      throw new DomainError(
        'LAST_OWNER_REQUIRED',
        'O workspace deve manter pelo menos um owner ativo.',
      );
    }
  }
}
