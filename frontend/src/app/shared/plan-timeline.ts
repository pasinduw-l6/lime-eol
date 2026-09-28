import { Component, computed, input } from '@angular/core';
import { ApiUpgradeAction } from '../core/api';

interface Marker {
  at: number;
  kind: 'target' | 'eol';
  label: string;
  late: boolean;
}

interface Tick {
  at: number;
  label: string;
}

const DAY = 86_400_000;

@Component({
  selector: 'lime-plan-timeline',
  host: { class: 'block' },
  template: `
    @if (markers().length > 0) {
      <div class="relative h-[62px] select-none">
        <div class="absolute inset-x-0 top-[26px] h-px" style="background: var(--color-rule)"></div>

        @for (tick of ticks(); track tick.at) {
          <span
            class="absolute top-[26px] h-[5px] w-px"
            style="background: var(--color-rule)"
            [style.left.%]="tick.at"
          ></span>
          <span
            class="tabular absolute top-[34px] -translate-x-1/2 text-[10px] text-ink-faint"
            [style.left.%]="tick.at"
          >
            {{ tick.label }}
          </span>
        }

        <span
          class="absolute top-[14px] bottom-[20px] w-px"
          style="background: var(--color-accent-bright)"
          [style.left.%]="today()"
        ></span>
        <span
          class="tabular absolute top-[2px] -translate-x-1/2 rounded-full px-1.5 text-[9.5px]"
          style="color: var(--color-accent-bright)"
          [style.left.%]="today()"
        >
          today
        </span>

        @for (marker of markers(); track $index) {
          <span
            class="absolute top-[21px] -translate-x-1/2 text-[11px] leading-none"
            [style.left.%]="marker.at"
            [style.color]="colourFor(marker)"
            [attr.title]="marker.label"
          >
            {{ marker.kind === 'eol' ? '✕' : '◆' }}
          </span>
        }
      </div>

      <p class="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-ink-faint">
        <span>◆ target date</span>
        <span>✕ support ends</span>
        <span style="color: var(--color-overdue)">◆ lands after support ends</span>
      </p>
    }
  `,
})
export class PlanTimeline {
  readonly actions = input.required<ApiUpgradeAction[]>();

  private readonly span = computed(() => {
    const now = Date.now();
    const stamps: number[] = [now];

    for (const action of this.actions()) {
      const target = parse(action.plannedDate);
      const eol = parse(action.eolDate);
      if (target) {
        stamps.push(target);
      }
      if (eol) {
        stamps.push(eol);
      }
    }

    const min = Math.min(...stamps);
    const max = Math.max(...stamps);

    const pad = Math.max((max - min) * 0.08, 20 * DAY);
    return { from: min - pad, to: max + pad };
  });

  private position(stamp: number): number {
    const { from, to } = this.span();
    return ((stamp - from) / (to - from)) * 100;
  }

  protected readonly today = computed(() => this.position(Date.now()));

  protected readonly markers = computed<Marker[]>(() => {
    const out: Marker[] = [];

    for (const action of this.actions()) {
      const name = `${action.technology} ${action.cycle}`;
      const target = parse(action.plannedDate);
      const eol = parse(action.eolDate);

      if (target) {
        out.push({
          at: this.position(target),
          kind: 'target',
          label: `${name} — target ${action.plannedDate}`,
          late: action.planTooLate,
        });
      }
      if (eol) {
        out.push({
          at: this.position(eol),
          kind: 'eol',
          label: `${name} — support ends ${action.eolDate}`,
          late: false,
        });
      }
    }

    return out;
  });

  protected readonly ticks = computed<Tick[]>(() => {
    const { from, to } = this.span();
    const out: Tick[] = [];

    const cursor = new Date(from);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor.getTime() <= to) {
      const stamp = cursor.getTime();
      if (stamp >= from) {
        out.push({
          at: this.position(stamp),
          label: cursor.toLocaleDateString('en-GB', {
            month: 'short',
            timeZone: 'UTC',
          }),
        });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return out.length > 14 ? out.filter((_, index) => index % 2 === 0) : out;
  });

  protected colourFor(marker: Marker): string {
    if (marker.late) {
      return 'var(--color-overdue)';
    }
    return marker.kind === 'eol' ? 'var(--color-soon)' : 'var(--color-ink-soft)';
  }
}

function parse(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const stamp = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(stamp) ? null : stamp;
}
