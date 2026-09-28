import { Injectable, signal } from '@angular/core';
import { SupportStatus } from './lifecycle';

export type Tier = 'CLEARED' | 'RESCUED' | 'ROUTINE';

export interface Celebration {
  tier: Tier;
  title: string;
  detail: string;
}

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

export function celebrationFor(input: {
  technology: string;
  environment: string;
  fromVersion: string;
  toVersion: string;
  previousStatus: SupportStatus;
  daysOnNewVersion: number | null;
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

  return {
    tier: 'ROUTINE',
    title: 'Change recorded',
    detail: wasAtRisk
      ? `${move} · still needs attention`
      : `${move} · ${input.environment}`,
  };
}
