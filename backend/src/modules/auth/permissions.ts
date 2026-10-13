export const ROLES = ['VIEWER', 'SRE', 'ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

export type Permission =
  | 'estate:write'
  | 'customer:write'
  | 'plan:notice'
  | 'plan:decision'
  | 'plan:assess'
  | 'lime:write'
  | 'integration:write'
  | 'admin';

const GRANTS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'estate:write',
    'customer:write',
    'plan:notice',
    'plan:decision',
    'plan:assess',
    'lime:write',
    'integration:write',
    'admin',
  ],
  SRE: [
    'estate:write',
    'customer:write',
    'plan:notice',
    'plan:decision',
    'plan:assess',
    'integration:write',
  ],
  VIEWER: [],
};

export function can(role: string | undefined, permission: Permission): boolean {
  return !!role && (GRANTS[role as RoleName] ?? []).includes(permission);
}
