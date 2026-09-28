import { parseDate, today } from './lifecycle';


export type Tone = 'past' | 'soon' | 'future' | 'unknown';

const DAY = 86_400_000;

export function humanGap(days: number): string {
  const abs = Math.abs(days);

  if (abs < 1) {
    return 'today';
  }
  if (abs < 7) {
    return plural(abs, 'day');
  }
  if (abs < 31) {
    const weeks = Math.floor(abs / 7);
    const rest = abs % 7;
    return join(plural(weeks, 'week'), rest ? plural(rest, 'day') : '');
  }
  if (abs < 365) {
    const months = Math.floor(abs / 30.44);
    const rest = Math.floor((abs - months * 30.44) / 7);
    return join(plural(months, 'month'), rest ? plural(rest, 'week') : '');
  }

  const years = Math.floor(abs / 365.25);
  const months = Math.floor((abs - years * 365.25) / 30.44);
  return join(plural(years, 'year'), months ? plural(months, 'month') : '');
}

export interface Phrase {
  text: string;
  tone: Tone;
  days: number | null;
}

export function phraseFor(
  value: string | null,
  verb: 'end' | 'release' = 'end',
  noticeDays = 180,
): Phrase {
  const date = parseDate(value);

  if (!date) {
    return { text: '—', tone: 'unknown', days: null };
  }

  const days = Math.round((date.getTime() - today().getTime()) / DAY);

  if (verb === 'release') {
    return {
      text: days > 0 ? `In ${humanGap(days)}` : `${humanGap(days)} ago`,
      tone: 'future',
      days,
    };
  }

  if (days <= 0) {
    return { text: `Ended ${humanGap(days)} ago`, tone: 'past', days };
  }

  return {
    text: `Ends in ${humanGap(days)}`,
    tone: days <= noticeDays ? 'soon' : 'future',
    days,
  };
}

export function toneBackground(tone: Tone): string {
  switch (tone) {
    case 'past':
      return 'color-mix(in oklab, var(--color-overdue) 16%, transparent)';
    case 'soon':
      return 'color-mix(in oklab, var(--color-soon) 16%, transparent)';
    case 'future':
      return 'color-mix(in oklab, var(--color-good) 13%, transparent)';
    default:
      return 'transparent';
  }
}

export function toneColour(tone: Tone): string {
  switch (tone) {
    case 'past':
      return 'var(--color-overdue)';
    case 'soon':
      return 'var(--color-soon)';
    case 'future':
      return 'var(--color-good)';
    default:
      return 'var(--color-ink-soft)';
  }
}

function plural(value: number, unit: string): string {
  const rounded = Math.round(value);
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

function join(first: string, second: string): string {
  return second ? `${first} and ${second}` : first;
}
