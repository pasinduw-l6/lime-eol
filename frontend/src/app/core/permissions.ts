export type RoleName = string;

export type Permission =
  | 'estate:write'
  | 'plan:notice'
  | 'plan:decision'
  | 'plan:assess'
  | 'lime:write'
  | 'integration:write'
  | 'admin';

export type Page = 'overview' | 'manager' | 'projects' | 'lifecycle' | 'plan' | 'calendar';

export const PERMISSION_INFO: { key: Exclude<Permission, 'admin'>; label: string; description: string }[] = [
  { key: 'estate:write', label: 'Projects and environments', description: 'Add and change projects, environments and their technologies.' },
  { key: 'plan:notice', label: 'Customer notices', description: 'Record when a customer was told about an end of life.' },
  { key: 'plan:decision', label: 'Plan decisions', description: 'Set the plan, target dates, owners and Jira sub-tasks.' },
  { key: 'plan:assess', label: 'Assessments and time logs', description: 'Record impact assessments and log time.' },
  { key: 'lime:write', label: 'Lime releases', description: 'Manage Lime releases and their compatibility.' },
  { key: 'integration:write', label: 'Connections', description: 'Connect Jira boards and Teams channels.' },
];

export const PAGE_INFO: { key: Page; label: string; locked?: boolean }[] = [
  { key: 'overview', label: 'Overview', locked: true },
  { key: 'manager', label: 'Manager view' },
  { key: 'projects', label: 'Projects' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'plan', label: 'Plan' },
  { key: 'calendar', label: 'Calendar' },
];

export function permissionLabel(key: string): string {
  return PERMISSION_INFO.find((p) => p.key === key)?.label ?? key;
}

export function pageLabel(key: string): string {
  return PAGE_INFO.find((p) => p.key === key)?.label ?? key;
}
