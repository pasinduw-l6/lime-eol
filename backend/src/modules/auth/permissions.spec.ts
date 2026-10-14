import { cleanPages, cleanPermissions, GRANTABLE, has, PERMISSIONS } from './permissions';

describe('permissions', () => {
  it('checks a permission against a role list', () => {
    expect(has(['estate:write'], 'estate:write')).toBe(true);
    expect(has(['estate:write'], 'admin')).toBe(false);
    expect(has(undefined, 'estate:write')).toBe(false);
  });

  it('never lets a custom role carry the admin permission', () => {
    expect(GRANTABLE).not.toContain('admin');
    expect(cleanPermissions([...PERMISSIONS])).not.toContain('admin');
  });

  it('drops unknown permissions and keeps the catalogue order', () => {
    expect(cleanPermissions(['plan:notice', 'made:up', 'estate:write'])).toEqual(['estate:write', 'plan:notice']);
  });

  it('always includes the overview page and drops unknown pages', () => {
    expect(cleanPages(['plan', 'secret'])).toEqual(['overview', 'plan']);
    expect(cleanPages([])).toEqual(['overview']);
    expect(cleanPages(['overview', 'calendar'])).toEqual(['overview', 'calendar']);
  });
});
