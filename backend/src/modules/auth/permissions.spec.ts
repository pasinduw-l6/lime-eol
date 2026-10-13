import { can, Permission, ROLES } from './permissions';

const ALL: Permission[] = [
  'estate:write',
  'customer:write',
  'plan:notice',
  'plan:decision',
  'plan:assess',
  'lime:write',
  'integration:write',
  'admin',
];

describe('roles', () => {
  it('has three roles, least access first', () => {
    expect([...ROLES]).toEqual(['VIEWER', 'SRE', 'ADMIN']);
  });

  it('gives a viewer no changes at all', () => {
    for (const permission of ALL) expect(can('VIEWER', permission)).toBe(false);
  });

  it('lets SRE / DevOps change the estate, plans, customers and connections, but not Lime or people', () => {
    expect(ALL.filter((p) => can('SRE', p))).toEqual([
      'estate:write',
      'customer:write',
      'plan:notice',
      'plan:decision',
      'plan:assess',
      'integration:write',
    ]);
  });

  it('gives an admin everything', () => {
    for (const permission of ALL) expect(can('ADMIN', permission)).toBe(true);
  });

  it('treats removed or unknown roles as no access', () => {
    for (const role of ['BA', 'ACCOUNT', 'PRODUCT', undefined]) {
      for (const permission of ALL) expect(can(role, permission)).toBe(false);
    }
  });
});
