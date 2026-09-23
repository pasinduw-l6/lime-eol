import { Injectable, signal } from '@angular/core';
import { SupportStatus } from './lifecycle';

/**
 * Every recorded version change is celebrated.
 *
 * The picture does not vary — recording a change is the job, and doing the job
 * gets the reward. What varies is the line underneath, which says what the
 * change actually bought: clearing the last risk in an environment reads
 * differently from a routine patch, even though both earn the same grin.
 */
export type Tier = 'CLEARED' | 'RESCUED' | 'ROUTINE';

export interface Celebration {
  tier: Tier;
  title: string;
  detail: string;
}

/** Long enough to register, short enough not to be in the way. */
const HOLD_MS = 2600;

@Injectable({ providedIn: 'root' })
export class Celebrations {
  readonly current = signal<Celebration | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(celebration: Celebration | null): void {
    if (!celebration) {
      return;
    }

    clearTimeout(this.timer);
    this.current.set(celebration);
    this.timer = setTimeout(() => this.current.set(null), HOLD_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
}

/** Reads the change and picks the line that fits it. */
export function celebrationFor(input: {
  technology: string;
  environment: string;
  fromVersion: string;
  toVersion: string;
  /** Where the component stood before the change. */
  previousStatus: SupportStatus;
  /** Days until the version it moved onto goes end of life. */
  daysOnNewVersion: number | null;
  /** Statuses of everything else in the environment, to spot a clean sweep. */
  otherStatuses: SupportStatus[];
}): Celebration {
  const wasAtRisk =
    input.previousStatus === 'EOL' || input.previousStatus === 'NEAR';
  const nowSafe = input.daysOnNewVersion !== null && input.daysOnNewVersion > 180;

  const move = `${input.technology} ${input.fromVersion} → ${input.toVersion}`;

  const everythingElseClear = input.otherStatuses.every(
    (status) => status !== 'EOL' && status !== 'NEAR',
  );

  if (wasAtRisk && nowSafe && everythingElseClear) {
    return {
      tier: 'CLEARED',
      title: `${input.environment} is fully supported`,
      detail: `${move} was the last one at risk`,
    };
  }

  if (wasAtRisk && nowSafe) {
    return {
      tier: 'RESCUED',
      title: 'Off an unsupported version',
      detail: `${move} · ${input.environment}`,
    };
  }

  // Recorded and worth a grin, but the line stays honest: moving between two
  // unsupported versions has not fixed anything yet.
  return {
    tier: 'ROUTINE',
    title: 'Change recorded',
    detail: wasAtRisk
      ? `${move} · still needs attention`
      : `${move} · ${input.environment}`,
  };
}
