/**
 * Role-based permissions mapping.
 * Mirrors domain rules: owner > admin > member > viewer.
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type Permissions = {
  canManageMembers: boolean;
  canInvite: boolean;
  canWriteTaxonomy: boolean;
  canWritePlanning: boolean;
  canPromoteOwner: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
};

export function normalizeRole(role: string | null | undefined): WorkspaceRole {
  const value = (role ?? 'viewer').toLowerCase();
  if (value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer') {
    return value;
  }
  return 'viewer';
}

export function getPermissions(role: WorkspaceRole | string): Permissions {
  switch (normalizeRole(role)) {
    case 'owner':
      return {
        canManageMembers: true,
        canInvite: true,
        canWriteTaxonomy: true,
        canWritePlanning: true,
        canPromoteOwner: true,
        canRemoveMembers: true,
        canChangeRoles: true,
      };
    case 'admin':
      return {
        canManageMembers: true,
        canInvite: true,
        canWriteTaxonomy: true,
        canWritePlanning: true,
        canPromoteOwner: false,
        canRemoveMembers: true,
        canChangeRoles: true,
      };
    case 'member':
      return {
        canManageMembers: false,
        canInvite: false,
        canWriteTaxonomy: true,
        canWritePlanning: true,
        canPromoteOwner: false,
        canRemoveMembers: false,
        canChangeRoles: false,
      };
    case 'viewer':
      return {
        canManageMembers: false,
        canInvite: false,
        canWriteTaxonomy: false,
        canWritePlanning: false,
        canPromoteOwner: false,
        canRemoveMembers: false,
        canChangeRoles: false,
      };
  }
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  viewer: 'Somente leitura',
};
