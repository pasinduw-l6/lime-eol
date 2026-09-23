import { Injectable, signal } from '@angular/core';
import { SupportStatus } from './lifecycle';

/**
 * How much of a win a recorded change actually was.
 *
 * Tiered on purpose. If every change throws confetti it stops meaning anything
 * by the third one, and the screen starts nagging rather than rewarding.
 */
export type Tier = 'CLEARED' | 'RESCUED' | 'ROUTINE' | 'NONE';

export interface Celebration {
  tier: Exclude<Tier, 'NONE'>;
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

/**
 * Decides what a change earned.
 *
 * Deliberately silent in two cases: an ordinary patch between supported
 * versions is just the job, and a move from one unsupported version to another
 * is not a win — congratulating it would be tone deaf.
 */
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
}): Celebration | null {
  const wasAtRisk =
    input.previousStatus === 'EOL' || input.previousStatus === 'NEAR';
  const nowSafe = input.daysOnNewVersion !== null && input.daysOnNewVersion > 180;

  const move = `${input.technology} ${input.fromVersion} → ${input.toVersion}`;

  if (!wasAtRisk) {
    return nowSafe
      ? {
          tier: 'ROUTINE',
          title: 'Recorded',
          detail: `${move} · ${input.environment}`,
        }
      : null;
  }

  // Still on something unsupported, or on a cycle that ends within the notice
  // window. Recorded, but there is nothing to cheer about yet.
  if (!nowSafe) {
    return {
      tier: 'ROUTINE',
      title: 'Recorded',
      detail: `${move} · still needs attention`,
    };
  }

  const everythingElseClear = input.otherStatuses.every(
    (status) => status !== 'EOL' && status !== 'NEAR',
  );

  return everythingElseClear
    ? {
        tier: 'CLEARED',
        title: `${input.environment} is fully supported`,
        detail: `${move} was the last one at risk`,
      }
    : {
        tier: 'RESCUED',
        title: 'Off an unsupported version',
        detail: `${move} · ${input.environment}`,
      };
}
