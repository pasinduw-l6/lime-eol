import { NotificationCard } from './ports/notification-channel.port';

export interface Due {
  cycleId: string;
  technology: string;
  cycle: string;
  eolDate: Date;
  latestPatch: string | null;
  days: number;
  threshold: number;
  projectId: string;
  projectName: string;
  projectCode: string;
  environments: string[];
  versions: Set<string>;
  mention: { upn: string; name: string; why: string } | null;
}

export function buildDeadlineCard(due: Due, appUrl: string): NotificationCard {
  const past = due.days <= 0;
  const environments = [...new Set(due.environments)].sort();
  const versions = [...due.versions].sort().join(', ');

  const facts = [
    { title: 'Project', value: `${due.projectName} (${due.projectCode})` },
    {
      title: environments.length === 1 ? 'Environment' : 'Environments',
      value: environments.join(', '),
    },
    { title: 'Running', value: versions || '—' },
    {
      title: past ? 'Support ended' : 'Support ends',
      value: longDate(due.eolDate),
    },
  ];

  if (due.latestPatch) {
    facts.push({ title: 'Latest in cycle', value: due.latestPatch });
  }

  facts.push({
    title: 'Plan',
    value: due.mention && !due.mention.why.includes('lead')
      ? due.mention.name
      : 'None',
  });

  return {
    severity: past ? 'attention' : 'warning',
    heading: past
      ? `Unsupported for ${humanGap(due.days)}`
      : due.days === 0
        ? 'Support ends today'
        : `Support ends in ${humanGap(due.days)}`,
    title: `${due.technology} ${due.cycle}`,
    facts,
    mention: due.mention
      ? { upn: due.mention.upn, name: due.mention.name }
      : null,
    actions: [
      {
        title: 'Plan the upgrade',
        url: `${appUrl}/plan?technology=${encodeURIComponent(due.technology)}&cycle=${encodeURIComponent(due.cycle)}`,
      },
    ],
  };
}

export function buildDigest(dues: Due[], appUrl: string): NotificationCard {
  const past = dues.filter((d) => d.days <= 0);
  const soon = dues.filter((d) => d.days > 0);
  const project = dues[0]?.projectName ?? 'the estate';

  const sections: { heading: string; lines: string[] }[] = [];

  if (past.length > 0) {
    sections.push({
      heading: `Past end of life — ${past.length}`,
      lines: past.map(line),
    });
  }

  if (soon.length > 0) {
    sections.push({
      heading: `Ending within 180 days — ${soon.length}`,
      lines: soon.map(line),
    });
  }

  const unowned = dues.filter(
    (d) => !d.mention || d.mention.why.includes('lead'),
  ).length;

  return {
    severity: past.length > 0 ? 'attention' : 'warning',
    heading: `${dues.length} need attention`,
    title: project,
    facts:
      unowned === dues.length
        ? [{ title: 'Owned', value: 'None of them has a plan or an owner' }]
        : [{ title: 'Unowned', value: `${unowned} of ${dues.length}` }],
    mention: null,
    sections,
    actions: [{ title: 'Open the overview', url: `${appUrl}/overview` }],
  };
}

function line(due: Due): string {
  const environments = new Set(due.environments).size;
  const when =
    due.days <= 0 ? `${humanGap(due.days)} unsupported` : `${humanGap(due.days)} left`;

  return `${due.technology} ${due.cycle} — ${when} · ${environments} env`;
}

function humanGap(days: number): string {
  const abs = Math.abs(days);

  if (abs < 1) {
    return 'today';
  }
  if (abs < 31) {
    return plural(abs, 'day');
  }
  if (abs < 365) {
    return plural(Math.floor(abs / 30.44), 'month');
  }

  const years = Math.floor(abs / 365.25);
  const months = Math.floor((abs - years * 365.25) / 30.44);
  return months > 0
    ? `${plural(years, 'year')} and ${plural(months, 'month')}`
    : plural(years, 'year');
}

function plural(value: number, unit: string): string {
  const rounded = Math.round(value);
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

function longDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
