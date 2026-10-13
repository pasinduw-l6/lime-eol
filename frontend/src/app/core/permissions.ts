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

export const ROLE_INFO: Record<RoleName, { label: string; description: string }> = {
  VIEWER: {
    label: 'Viewer',
    description: 'Sees Overview, Plan, Lifecycle and Calendar. Cannot change anything.',
  },
  SRE: {
    label: 'SRE / DevOps',
    description:
      'Edits the projects they are assigned to: environments, plans, Jira, time logs and customers. Views the rest.',
  },
  ADMIN: {
    label: 'Admin',
    description: 'Everything on every project, plus people, access, Lime releases and connections.',
  },
};

export function can(role: string | undefined | null, permission: Permission): boolean {
  return !!role && (GRANTS[role as RoleName] ?? []).includes(permission);
}

export function isViewer(role: string | undefined | null): boolean {
  return !role || role === 'VIEWER';
}
