/**
 * One thing worth announcing.
 *
 * Every detector produces these and nothing else, so adding a tenth kind of
 * message is a new detector rather than a new path through the sender. The
 * dispatcher deduplicates, renders and delivers them all the same way.
 */
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
  /** The address Teams resolves - a UPN is enough for an incoming webhook. */
  upn: string;
  name: string;
}

export interface NotificationEvent {
  kind: EventKind;

  /**
   * Unique per announcement, and stable across runs.
   *
   * Two runs that find the same thing must build the same key, or the same
   * message is posted every time the job wakes up. Anything that should be said
   * again later puts the repeating part in the key - a week number, a date.
   */
  dedupKey: string;

  /** What it is about, for the record. An action id, a cycle id, 'estate'. */
  subject?: string;

  severity: Severity;
  title: string;
  subtitle?: string;
  facts: EventFact[];

  /** Free lines rendered under the facts, for lists the facts cannot hold. */
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

/**
 * The colour Teams paints the card's left edge with.
 *
 * Only these four are understood - anything else renders with no accent at
 * all, which reads as a card that failed rather than one that is calm.
 */
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
