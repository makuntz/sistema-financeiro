import { describe, it, expect } from 'vitest';
import { getPermissions, ROLE_LABELS } from '../lib/permissions';

describe('getPermissions', () => {
  it('owner has all permissions', () => {
    const p = getPermissions('owner');
    expect(p.canManageMembers).toBe(true);
    expect(p.canInvite).toBe(true);
    expect(p.canWriteTaxonomy).toBe(true);
    expect(p.canWritePlanning).toBe(true);
    expect(p.canWriteLedger).toBe(true);
    expect(p.canPromoteOwner).toBe(true);
    expect(p.canRemoveMembers).toBe(true);
    expect(p.canChangeRoles).toBe(true);
  });

  it('admin can manage members and taxonomy but not promote owner', () => {
    const p = getPermissions('ADMIN');
    expect(p.canManageMembers).toBe(true);
    expect(p.canInvite).toBe(true);
    expect(p.canWriteTaxonomy).toBe(true);
    expect(p.canWritePlanning).toBe(true);
    expect(p.canWriteLedger).toBe(true);
    expect(p.canPromoteOwner).toBe(false);
    expect(p.canRemoveMembers).toBe(true);
    expect(p.canChangeRoles).toBe(true);
  });

  it('member can only write taxonomy and planning', () => {
    const p = getPermissions('member');
    expect(p.canManageMembers).toBe(false);
    expect(p.canInvite).toBe(false);
    expect(p.canWriteTaxonomy).toBe(true);
    expect(p.canWritePlanning).toBe(true);
    expect(p.canWriteLedger).toBe(true);
    expect(p.canPromoteOwner).toBe(false);
  });

  it('viewer has read-only access', () => {
    const p = getPermissions('viewer');
    expect(p.canManageMembers).toBe(false);
    expect(p.canInvite).toBe(false);
    expect(p.canWriteTaxonomy).toBe(false);
    expect(p.canWritePlanning).toBe(false);
    expect(p.canWriteLedger).toBe(false);
    expect(p.canPromoteOwner).toBe(false);
  });
});

describe('ROLE_LABELS', () => {
  it('has Portuguese labels for all roles', () => {
    expect(ROLE_LABELS.owner).toBe('Proprietário');
    expect(ROLE_LABELS.admin).toBe('Administrador');
    expect(ROLE_LABELS.member).toBe('Membro');
    expect(ROLE_LABELS.viewer).toBe('Somente leitura');
  });
});
