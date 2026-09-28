
export const NOTICE_DAYS = 180;

export type SupportStatus = 'EOL' | 'NEAR' | 'SUPPORTED' | 'UNKNOWN';

const MS_PER_DAY = 86_400_000;

export function today(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysToEol(eolDate: string | null): number | null {
  const parsed = parseDate(eolDate);
  return parsed
    ? Math.round((parsed.getTime() - today().getTime()) / MS_PER_DAY)
    : null;
}

export function statusOf(days: number | null): SupportStatus {
  if (days === null) {
    return 'UNKNOWN';
  }
  if (days <= 0) {
    return 'EOL';
  }
  return days <= NOTICE_DAYS ? 'NEAR' : 'SUPPORTED';
}

export function formatDays(days: number | null): string {
  if (days === null) {
    return '—';
  }
  return days < 0 ? `−${Math.abs(days)} d` : `${days} d`;
}

export function statusLabel(status: SupportStatus): string {
  switch (status) {
    case 'EOL':
      return 'Past end of life';
    case 'NEAR':
      return `Ends within ${NOTICE_DAYS} days`;
    case 'SUPPORTED':
      return 'Supported';
    default:
      return 'No published date';
  }
}

export function statusTextClass(status: SupportStatus): string {
  switch (status) {
    case 'EOL':
      return 'text-overdue';
    case 'NEAR':
      return 'text-soon';
    default:
      return 'text-ink-soft';
  }
}

export function statusFill(status: SupportStatus): string {
  switch (status) {
    case 'EOL':
      return 'var(--color-overdue)';
    case 'NEAR':
      return 'var(--color-soon)';
    case 'SUPPORTED':
      return 'var(--color-ink-soft)';
    default:
      return 'var(--color-rule)';
  }
}

export function formatDate(value: string | null): string {
  const parsed = parseDate(value);
  if (!parsed) {
    return '—';
  }
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
