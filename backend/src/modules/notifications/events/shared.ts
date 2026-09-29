import { PrismaService } from '../../../prisma/prisma.service';
import { EventMention } from './notification-event';

/**
 * Everyone who can act on an end-of-life warning.
 *
 * End-of-life is estate-wide and nobody owns it individually, so these go to
 * every active editor rather than to a project lead. Jira announcements do the
 * opposite: they name the person the work is actually sitting with.
 */
export async function everyEngineer(
  prisma: PrismaService,
): Promise<EventMention[]> {
  const users = await prisma.appUser.findMany({
    where: { isActive: true, role: { not: 'VIEWER' } },
    orderBy: { displayName: 'asc' },
  });

  return users.map((user) => ({
    upn: user.email,
    name: user.displayName ?? user.email,
  }));
}

/**
 * The year and week, e.g. 2026-W40.
 *
 * Used as the changing part of a weekly announcement's key, so the digest is
 * sent once a week however often the job runs.
 */
export function isoWeek(date: Date): string {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // Thursday decides the year a week belongs to, which is what stops the last
  // days of December landing in week 1 of the wrong year.
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );

  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function longDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function plural(value: number, unit: string): string {
  return value === 1 ? unit : `${unit}s`;
}
