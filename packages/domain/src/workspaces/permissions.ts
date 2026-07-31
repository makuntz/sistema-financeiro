export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

export type Permission =
  | 'workspace.read'
  | 'workspace.update'
  | 'members.read'
  | 'members.manage'
  | 'invitations.create'
  | 'invitations.read'
  | 'invitations.revoke'
  | 'taxonomy.read'
  | 'taxonomy.create'
  | 'taxonomy.update'
  | 'taxonomy.inactivate'
  | 'planning.read'
  | 'planning.write'
  | 'financial.read'
  | 'financial.write'
  | 'ledger.read'
  | 'ledger.write'
  | 'reports.read';

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  owner: [
    'workspace.read',
    'workspace.update',
    'members.read',
    'members.manage',
    'invitations.create',
    'invitations.read',
    'invitations.revoke',
    'taxonomy.read',
    'taxonomy.create',
    'taxonomy.update',
    'taxonomy.inactivate',
    'planning.read',
    'planning.write',
    'financial.read',
    'financial.write',
    'ledger.read',
    'ledger.write',
    'reports.read',
  ],
  admin: [
    'workspace.read',
    'workspace.update',
    'members.read',
    'members.manage',
    'invitations.create',
    'invitations.read',
    'invitations.revoke',
    'taxonomy.read',
    'taxonomy.create',
    'taxonomy.update',
    'taxonomy.inactivate',
    'planning.read',
    'planning.write',
    'financial.read',
    'financial.write',
    'ledger.read',
    'ledger.write',
    'reports.read',
  ],
  member: [
    'workspace.read',
    'members.read',
    'taxonomy.read',
    'taxonomy.create',
    'taxonomy.update',
    'taxonomy.inactivate',
    'planning.read',
    'planning.write',
    'financial.read',
    'financial.write',
    'ledger.read',
    'ledger.write',
    'reports.read',
  ],
  viewer: [
    'workspace.read',
    'members.read',
    'taxonomy.read',
    'planning.read',
    'financial.read',
    'ledger.read',
    'reports.read',
  ],
};

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
