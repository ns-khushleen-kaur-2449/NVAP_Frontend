import {
  ASSISTANT_VIEWER_ROLES,
  CAMPAIGN_CREATOR_ROLES,
  CAN_CREATE,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canCreate,
  canCreateCampaigns,
  canDeleteCampaigns,
  canLiftDoNotCall,
  canManageCampaigns,
  canManageUser,
  canViewAssistants,
  creatableRoles,
  hasPermission,
} from './rbac';

const ROLES = ['super_admin', 'tenant_admin', 'manager', 'rep'];

/** The spec, written independently of rbac.js. */
function expected(actorRole, targetRole, sameTenant, sameTeam) {
  if (actorRole === 'super_admin') return targetRole === 'tenant_admin';
  if (actorRole === 'tenant_admin') return ['manager', 'rep'].includes(targetRole) && sameTenant;
  if (actorRole === 'manager') return targetRole === 'rep' && sameTenant && sameTeam;
  return false;
}

const actorOf = (role) => ({ id: 1, role, tenant_id: role === 'super_admin' ? null : 't-1', manager_user_id: null });

function targetOf(actor, role, sameTenant, sameTeam) {
  const tenant = sameTenant ? (actor.tenant_id || 't-1') : 't-2';
  let manager = null;
  if (role === 'rep') manager = sameTeam && actor.role === 'manager' ? actor.id : 99;
  return { id: 2, role, tenant_id: role === 'super_admin' ? null : tenant, manager_user_id: manager };
}

describe('canManageUser: actor role x target role x same/different tenant x same/different team', () => {
  const cases = [];
  ROLES.forEach((actorRole) => ROLES.forEach((targetRole) => [true, false].forEach((sameTenant) =>
    [true, false].forEach((sameTeam) => cases.push([actorRole, targetRole, sameTenant, sameTeam])))));

  test.each(cases)('%s managing %s (same tenant: %s, same team: %s)', (actorRole, targetRole, sameTenant, sameTeam) => {
    const actor = actorOf(actorRole);
    const target = targetOf(actor, targetRole, sameTenant, sameTeam);
    expect(canManageUser(actor, target)).toBe(expected(actorRole, targetRole, sameTenant, sameTeam));
  });

  test('nobody manages themselves', () => {
    ROLES.forEach((role) => {
      const actor = actorOf(role);
      expect(canManageUser(actor, { ...actor })).toBe(false);
    });
  });

  test('ids from the server (numbers or strings) and tenant UUIDs compare by value', () => {
    const manager = { id: 7, role: 'manager', tenant_id: 'a1b2', manager_user_id: null };
    expect(canManageUser(manager, { id: '8', role: 'rep', tenant_id: 'a1b2', manager_user_id: '7' })).toBe(true);
  });

  test('missing actor or target is never allowed', () => {
    expect(canManageUser(null, { id: 1, role: 'rep' })).toBe(false);
    expect(canManageUser(actorOf('tenant_admin'), null)).toBe(false);
  });
});

describe('creatableRoles / canCreate', () => {
  test.each([
    ['super_admin', ['tenant_admin']],
    ['tenant_admin', ['manager', 'rep']],
    ['manager', ['rep']],
    ['rep', []],
  ])('%s may create %j', (role, roles) => {
    const actor = actorOf(role);
    expect(creatableRoles(actor)).toEqual(roles);
    ROLES.forEach((target) => expect(canCreate(actor, target)).toBe(roles.includes(target)));
  });

  test('the server-provided list wins over the local map', () => {
    expect(creatableRoles({ role: 'tenant_admin', creatable_roles: ['rep'] })).toEqual(['rep']);
  });

  test('nobody may create a super admin', () => {
    Object.values(CAN_CREATE).forEach((roles) => expect(roles).not.toContain('super_admin'));
  });
});

describe('permissions', () => {
  test('each role has exactly its dashboard permission', () => {
    const dashboards = { super_admin: PERMISSIONS.DASHBOARD_PLATFORM, tenant_admin: PERMISSIONS.DASHBOARD_TENANT,
      manager: PERMISSIONS.DASHBOARD_TEAM, rep: PERMISSIONS.DASHBOARD_OWN };
    ROLES.forEach((role) => {
      const own = ROLE_PERMISSIONS[role].filter((p) => p.startsWith('dashboard.'));
      expect(own).toEqual([dashboards[role]]);
    });
  });

  test('only a super admin manages tenants, only a tenant admin manages teams, a rep sees no users', () => {
    expect(ROLES.filter((r) => hasPermission(actorOf(r), PERMISSIONS.TENANTS_MANAGE))).toEqual(['super_admin']);
    expect(ROLES.filter((r) => hasPermission(actorOf(r), PERMISSIONS.TEAMS_MANAGE))).toEqual(['tenant_admin']);
    expect(hasPermission(actorOf('rep'), PERMISSIONS.USERS_VIEW)).toBe(false);
  });

  test('every role views agents, only a super admin manages the catalog', () => {
    expect(ROLES.filter((r) => hasPermission(actorOf(r), PERMISSIONS.AGENTS_VIEW))).toEqual(ROLES);
    expect(ROLES.filter((r) => hasPermission(actorOf(r), PERMISSIONS.AGENTS_MANAGE))).toEqual(['super_admin']);
  });

  test('server-provided permissions win', () => {
    expect(hasPermission({ role: 'rep', permissions: ['users.view'] }, 'users.view')).toBe(true);
    expect(hasPermission(null, 'users.view')).toBe(false);
  });
});


describe('canViewAssistants (backend AssistantAction.VIEW: Manager and up)', () => {
  it.each([['super_admin', true], ['tenant_admin', true], ['manager', true], ['rep', false]])('%s -> %s', (role, expected) => {
    expect(canViewAssistants({ role })).toBe(expected);
  });
  it('refuses no user', () => {
    expect(canViewAssistants(null)).toBe(false);
    expect(ASSISTANT_VIEWER_ROLES).not.toContain('rep');
  });
});

describe('canCreateCampaigns (backend CAMPAIGN_CREATOR_ROLES: Tenant Admin, Manager, Sales Rep)', () => {
  it.each([['super_admin', false], ['tenant_admin', true], ['manager', true], ['rep', true], ['unknown', false]])('%s -> %s', (role, expected) => {
    expect(canCreateCampaigns({ role })).toBe(expected);
  });
  it('refuses no user', () => {
    expect(canCreateCampaigns(null)).toBe(false);
    expect(CAMPAIGN_CREATOR_ROLES).toEqual(['tenant_admin', 'manager', 'rep']);
  });
  it('manages campaigns with the same roles', () => {
    for (const role of ['super_admin', 'tenant_admin', 'manager', 'rep']) {
      expect(canManageCampaigns({ role })).toBe(canCreateCampaigns({ role }));
    }
  });
});

describe('canDeleteCampaigns (backend: Tenant Admin, Manager; never Sales Rep or Super Admin)', () => {
  it.each([['super_admin', false], ['tenant_admin', true], ['manager', true], ['rep', false]])('%s -> %s', (role, expected) => {
    expect(canDeleteCampaigns({ role })).toBe(expected);
  });
});

describe('canLiftDoNotCall', () => {
  it('is a Tenant Admin only: an entry blocks the number for every team', () => {
    expect(['super_admin', 'tenant_admin', 'manager', 'rep'].map((role) => canLiftDoNotCall({ role })))
      .toEqual([false, true, false, false]);
    expect(canLiftDoNotCall(null)).toBe(false);
  });
});
