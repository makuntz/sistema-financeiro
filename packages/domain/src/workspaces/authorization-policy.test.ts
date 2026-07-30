import { describe, expect, it } from 'vitest';
import { WorkspaceAuthorizationPolicy } from './authorization-policy.js';
import { DomainError } from '../shared/domain-error.js';

describe('WorkspaceAuthorizationPolicy', () => {
  const policy = new WorkspaceAuthorizationPolicy();

  it('owner convida qualquer papel', () => {
    expect(policy.canInviteRole('owner', 'owner')).toBe(true);
    expect(policy.canInviteRole('owner', 'member')).toBe(true);
  });

  it('admin não convida owner', () => {
    expect(policy.canInviteRole('admin', 'owner')).toBe(false);
    expect(policy.canInviteRole('admin', 'member')).toBe(true);
    expect(() => policy.assertCanInviteRole('admin', 'owner')).toThrow(DomainError);
  });

  it('member e viewer não convidam', () => {
    expect(() => policy.assertCanInviteRole('member', 'viewer')).toThrow(DomainError);
    expect(() => policy.assertCanInviteRole('viewer', 'member')).toThrow(DomainError);
  });

  it('protege último owner', () => {
    expect(() =>
      policy.assertCanChangeRole({
        actorRole: 'owner',
        currentRole: 'owner',
        nextRole: 'member',
        activeOwnerCount: 1,
      }),
    ).toThrowError(/LAST_OWNER_REQUIRED|owner/i);

    expect(() =>
      policy.assertCanDeactivateMember({
        actorRole: 'owner',
        targetRole: 'owner',
        targetUserId: 'u1',
        actorUserId: 'u1',
        activeOwnerCount: 1,
        isSelfLeave: true,
      }),
    ).toThrow(DomainError);
  });

  it('viewer não cria categoria', () => {
    expect(policy.hasPermission('viewer', 'taxonomy.create')).toBe(false);
    expect(policy.hasPermission('viewer', 'taxonomy.read')).toBe(true);
  });
});
