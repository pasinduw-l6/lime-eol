import { Component, computed, input } from '@angular/core';
import { ApiChange } from '../core/api';
import { TechIcon } from './tech-icon';

const REASON_COLOUR: Record<string, string> = {
  SECURITY_PATCH: 'var(--color-overdue)',
  ROLLBACK: 'var(--color-soon)',
  DRIFT_CORRECTION: 'var(--color-soon)',
  INITIAL_RECORD: 'var(--color-ink-faint)',
  DECOMMISSION: 'var(--color-ink-faint)',
  PLANNED_UPGRADE: 'var(--color-accent-bright)',
};

const REASON_LABEL: Record<string, string> = {
  SECURITY_PATCH: 'Security patch',
  ROLLBACK: 'Rollback',
  DRIFT_CORRECTION: 'Drift correction',
  INITIAL_RECORD: 'Initial record',
  DECOMMISSION: 'Decommission',
  PLANNED_UPGRADE: 'Planned upgrade',
};

@Component({
  selector: 'lime-change-timeline',
  imports: [TechIcon],
  host: { class: 'block' },
  template: `
    <ol class="relative m-0 list-none p-0">
      @if (entries().length > 1) {
        <span
          class="absolute top-3 bottom-3 w-px"
          [style.left.px]="threadX"
          style="background: var(--color-rule)"
          aria-hidden="true"
        ></span>
      }

      @for (entry of entries(); track entry.id) {
        <li
          class="timeline-item relative flex items-start gap-4 py-3"
          [style.animation-delay.ms]="$index * 45"
        >
          <span class="tabular w-[76px] shrink-0 pt-0.5 text-right text-[12px] text-ink-soft">
            {{ entry.when }}
          </span>

          <span class="relative z-10 flex h-[22px] w-[10px] shrink-0 items-center justify-center">
            <span
              class="h-[10px] w-[10px] rounded-full"
              [style.background]="entry.colour"
              [style.box-shadow]="'0 0 0 3px var(--color-surface)'"
              aria-hidden="true"
            ></span>
          </span>

          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <lime-tech-icon [technology]="entry.technology" [size]="16" />
              <span class="text-[14px] font-medium">{{ entry.title }}</span>
              <span class="text-[11.5px]" [style.color]="entry.colour">
                {{ entry.reason }}
              </span>
            </span>

            <span class="mt-0.5 block text-[12px] text-ink-soft">
              @if (entry.ticket) {
                <span class="tabular text-accent-bright">{{ entry.ticket }}</span>
                <span> · </span>
              }
              {{ entry.who }}
              @if (entry.evidenceUrl) {
                <span> · </span>
                <a
                  [href]="entry.evidenceUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-accent-bright no-underline hover:underline"
                  >evidence</a
                >
              }
            </span>

            @if (entry.note) {
              <span class="mt-0.5 block text-[12px] text-ink-faint">{{ entry.note }}</span>
            }
          </span>
        </li>
      } @empty {
        <li class="py-3 text-[13px] text-ink-soft">Nothing recorded yet.</li>
      }
    </ol>
  `,
  styles: `
    .timeline-item {
      animation: timeline-rise 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes timeline-rise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class ChangeTimeline {
  readonly changes = input.required<ApiChange[]>();
  readonly limit = input<number>(0);

  protected readonly threadX = 81;

  protected readonly entries = computed(() => {
    const all = this.changes();
    const visible = this.limit() > 0 ? all.slice(0, this.limit()) : all;

    return visible.map((change) => ({
      id: change.id,
      technology: change.technology,
      when: formatWhen(change.effectiveAt),
      title: change.fromVersion
        ? `${change.technology} ${change.fromVersion} → ${change.toVersion}`
        : `${change.technology} ${change.toVersion} installed`,
      reason: REASON_LABEL[change.reason] ?? change.reason.toLowerCase(),
      colour: REASON_COLOUR[change.reason] ?? 'var(--color-accent)',
      ticket: change.ticketRef,
      who: change.recordedBy ? `by ${change.recordedBy}` : 'recorded by unknown',
      note: change.note,
      evidenceUrl: change.evidenceUrl,
    }));
  });
}

function formatWhen(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}
