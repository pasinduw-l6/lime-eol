export type EventKind =
  | 'eol.date-moved'
  | 'eol.unmaintained'
  | 'jira.raised'
  | 'jira.in-progress'
  | 'jira.done'
  | 'jira.sync-failing'
  | 'plan.overdue'
  | 'estate.weekly';

export type Severity = 'critical' | 'warning' | 'info' | 'good';

export interface EventFact {
  title: string;
  value: string;
}

export interface EventAction {
  label: string;
  url: string;
}

export interface EventMention {
  upn: string;
  name: string;
}

export interface NotificationEvent {
  kind: EventKind;

  dedupKey: string;

  subject?: string;

  severity: Severity;
  title: string;
  subtitle?: string;
  facts: EventFact[];

  lines?: string[];

  mentions: EventMention[];
  actions: EventAction[];
}

const ICONS: Record<Severity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
  good: '🟢',
};

export function iconFor(severity: Severity): string {
  return ICONS[severity];
}

export function containerStyleFor(
  severity: Severity,
): 'attention' | 'warning' | 'accent' | 'good' {
  switch (severity) {
    case 'critical':
      return 'attention';
    case 'warning':
      return 'warning';
    case 'good':
      return 'good';
    default:
      return 'accent';
  }
}
