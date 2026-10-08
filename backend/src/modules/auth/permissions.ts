export const ROLES = ['ADMIN', 'SRE', 'PRODUCT', 'BA', 'ACCOUNT', 'VIEWER'] as const;
export type RoleName = (typeof ROLES)[number];

export type Permission =
  | 'estate:write'
  | 'customer:write'
  | 'plan:notice'
  | 'plan:decision'
  | 'plan:assess'
  | 'lime:write'
  | 'admin';

const GRANTS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'estate:write',
    'customer:write',
    'plan:notice',
    'plan:decision',
    'plan:assess',
    'lime:write',
    'admin',
  ],
  SRE: ['estate:write', 'plan:notice', 'plan:decision', 'plan:assess'],
  PRODUCT: ['lime:write', 'plan:assess'],
  BA: ['customer:write', 'plan:notice'],
  ACCOUNT: ['customer:write', 'plan:notice', 'plan:decision'],
  VIEWER: [],
};

export function can(role: string | undefined, permission: Permission): boolean {
  return !!role && (GRANTS[role as RoleName] ?? []).includes(permission);
}
