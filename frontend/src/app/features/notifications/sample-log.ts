/**
 * A worked example of a send log.
 *
 * SAMPLE DATA. Nothing here was sent — there is no delivery adapter yet. It
 * exists so the shape of the log can be judged before it is built, and every
 * screen that shows it says so.
 *
 * Delete this file when `notification_log` is served by the API; the page reads
 * it from one place.
 */
export interface SampleSend {
  at: string;
  technology: string;
  cycle: string;
  threshold: number;
  recipient: string;
  channel: 'TEAMS' | 'EMAIL';
  success: boolean;
  error?: string;
  note: string;
}

export const SAMPLE_LOG: SampleSend[] = [
  {
    at: '2026-09-22T08:00:04+05:30',
    technology: 'Docker Engine',
    cycle: '18.09',
    threshold: 0,
    recipient: 'Lime DevOps (Teams)',
    channel: 'TEAMS',
    success: false,
    // The failure that matters most: it looks exactly like a quiet week.
    error: 'HTTP 401 — webhook signature missing or expired',
    note: 'weekly past-EOL reminder',
  },
  {
    at: '2026-09-15T08:00:03+05:30',
    technology: 'Docker Engine',
    cycle: '18.09',
    threshold: 0,
    recipient: 'Lime DevOps (Teams)',
    channel: 'TEAMS',
    success: true,
    note: 'weekly past-EOL reminder',
  },
  {
    at: '2026-09-08T08:00:02+05:30',
    technology: 'Kubernetes',
    cycle: '1.34',
    threshold: 90,
    recipient: 'Lime DevOps (Teams)',
    channel: 'TEAMS',
    success: true,
    note: 'mentioned @Dinith — nobody assigned',
  },
  {
    at: '2026-08-25T08:00:05+05:30',
    technology: 'Angular',
    cycle: '20',
    threshold: 90,
    recipient: 'Lime DevOps (Teams)',
    channel: 'TEAMS',
    success: true,
    note: 'mentioned @Dinith — nobody assigned',
  },
  {
    at: '2026-07-14T08:00:03+05:30',
    technology: 'Red Hat Enterprise Linux',
    cycle: '7',
    threshold: 0,
    recipient: 'Lime DevOps (Teams)',
    channel: 'TEAMS',
    success: true,
    note: 'weekly past-EOL reminder',
  },
  {
    at: '2026-05-31T08:00:02+05:30',
    technology: 'Kubernetes',
    cycle: '1.35',
    threshold: 180,
    recipient: 'Lime DevOps (Teams)',
    channel: 'TEAMS',
    success: true,
    note: 'first notice',
  },
];
