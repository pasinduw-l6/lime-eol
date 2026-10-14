export const BUILT_IN_ROLES = ['VIEWER', 'SRE', 'ADMIN'] as const;

export const PERMISSIONS = [
  'estate:write',
  'plan:notice',
  'plan:decision',
  'plan:assess',
  'lime:write',
  'integration:write',
  'admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PAGES = ['overview', 'manager', 'projects', 'lifecycle', 'plan', 'calendar'] as const;

export type Page = (typeof PAGES)[number];

export const GRANTABLE: Permission[] = PERMISSIONS.filter((p) => p !== 'admin');

export function has(permissions: readonly string[] | undefined, permission: Permission): boolean {
  return !!permissions && permissions.includes(permission);
}

export function cleanPermissions(values: readonly string[] | undefined): Permission[] {
  return GRANTABLE.filter((p) => values?.includes(p));
}

export function cleanPages(values: readonly string[] | undefined): Page[] {
  const pages = PAGES.filter((p) => values?.includes(p));
  return pages.includes('overview') ? pages : ['overview', ...pages];
}
