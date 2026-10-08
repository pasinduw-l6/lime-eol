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

export const ROLE_INFO: Record<RoleName, { label: string; description: string }> = {
  ADMIN: { label: 'Admin', description: 'Everything, including users, teams and settings' },
  SRE: { label: 'SRE / DevOps', description: 'Projects, environments, registry and upgrade plans' },
  PRODUCT: { label: 'Product / Engineering', description: 'Lime releases, compatibility and assessments' },
  BA: { label: 'Customer / BA', description: 'Customers, agreements and customer notices' },
  ACCOUNT: { label: 'Account manager', description: 'Customers, notices and commercial decisions' },
  VIEWER: { label: 'Viewer', description: 'Read only' },
};

export function can(role: string | undefined | null, permission: Permission): boolean {
  return !!role && (GRANTS[role as RoleName] ?? []).includes(permission);
}
