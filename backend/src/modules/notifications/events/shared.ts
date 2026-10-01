import { PrismaService } from '../../../prisma/prisma.service';
import { EventMention } from './notification-event';

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

export function isoWeek(date: Date): string {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

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
