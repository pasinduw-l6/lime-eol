import { Component, computed, inject, signal } from '@angular/core';
import { Api, ApiNotificationLog } from '../core/api';
import { NotificationPreview } from '../features/notifications/notification-preview';
import { TechIcon } from './tech-icon';

const SEEN_KEY = 'lime.notifications.seen';

interface Row extends ApiNotificationLog {
  unread: boolean;
  when: string;
}

@Component({
  selector: 'lime-notification-menu',
  imports: [TechIcon],
  host: { class: 'relative' },
  template: `
    <button
      type="button"
      class="glass relative grid h-9 w-9 place-items-center rounded-full border border-rule text-ink-soft hover:text-ink"
      [class.glass-accent]="open()"
      [attr.aria-expanded]="open()"
      aria-haspopup="true"
      [attr.aria-label]="
        unreadCount() > 0 ? unreadCount() + ' new notifications' : 'Notifications'
      "
      (click)="toggle()"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-linejoin="round" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke-linecap="round" />
      </svg>

      @if (unreadCount() > 0) {
        <span
          class="tabular absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold"
          [style.background]="hasFailure() ? 'var(--color-overdue)' : 'var(--color-accent)'"
          [style.color]="hasFailure() ? '#ffffff' : 'var(--color-ground)'"
          aria-hidden="true"
          >{{ unreadCount() }}</span
        >
      }
    </button>

    @if (open()) {
      <div class="fixed inset-0 z-30" (click)="open.set(false)" aria-hidden="true"></div>

      <div
        class="card popover absolute top-[46px] right-0 z-40 w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden p-0 shadow-2xl"
        role="region"
        aria-label="Notifications"
        (keydown.escape)="open.set(false)"
      >
        <header class="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <h2 class="m-0 text-[14px] font-semibold">Notifications</h2>
          @if (unreadCount() > 0) {
            <button type="button" class="text-[12px] text-accent-bright" (click)="markAllRead()">
              Mark all read
            </button>
          }
        </header>

        <div class="border-b border-rule px-4 py-2.5 text-[12px]">
          <p class="m-0 flex items-center gap-2" [style.color]="health().colour">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              [style.background]="health().colour"
              aria-hidden="true"
            ></span>
            {{ health().label }}
          </p>
          <p class="m-0 mt-0.5 text-ink-faint">{{ health().detail }}</p>
        </div>

        <ol class="scroll-hidden m-0 max-h-[46vh] list-none overflow-y-auto p-0">
          @for (row of rows(); track row.id) {
            <li
              class="flex gap-3 border-b border-rule px-4 py-3 last:border-b-0"
              [style.background]="
                row.unread ? 'color-mix(in oklab, var(--color-accent) 7%, transparent)' : null
              "
            >
              <span class="relative shrink-0 pt-0.5">
                <lime-tech-icon [technology]="row.technology" [size]="22" />
                @if (!row.success) {
                  <span
                    class="absolute -right-1 -bottom-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[9px] font-bold"
                    style="background: var(--color-overdue); color: #ffffff"
                    aria-hidden="true"
                    >!</span
                  >
                }
              </span>

              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px]" [class.font-semibold]="row.unread">
                  {{ row.technology }} {{ row.cycle }}
                </span>
                <span class="block text-[12px] text-ink-soft">
                  {{ row.threshold === 0 ? 'End of life' : row.threshold + '-day notice' }}
                  · {{ row.recipient }}
                </span>
                @if (!row.success) {
                  <span class="mt-0.5 block text-[11.5px]" style="color: var(--color-overdue)">
                    Not delivered — {{ row.error }}
                  </span>
                }
              </span>

              <span class="tabular shrink-0 pt-0.5 text-right text-[11.5px] text-ink-faint">
                {{ row.when }}
              </span>
            </li>
          } @empty {
            <li class="px-4 py-8 text-center text-[13px] text-ink-soft">
              Nothing has been announced yet.
            </li>
          }
        </ol>
      </div>
    }
  `,
})
export class NotificationMenu {
  private readonly api = inject(Api);
  protected readonly preview = inject(NotificationPreview);

  protected readonly open = signal(false);
  private readonly seenAt = signal<number>(restoreSeen());

  protected readonly rows = computed<Row[]>(() =>
    [...this.api.notificationLog()]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .map((entry) => ({
        ...entry,
        unread: Date.parse(entry.at) > this.seenAt(),
        when: relative(entry.at),
      })),
  );

  protected readonly unreadCount = computed(
    () => this.rows().filter((r) => r.unread).length,
  );

  protected readonly hasFailure = computed(() =>
    this.rows().some((r) => r.unread && !r.success),
  );

  protected readonly health = computed(() => {
    const status = this.api.notificationStatus();
    const pending = this.preview.pending().length;
    const schedule = `${pending} due · runs 08:00 daily`;

    if (!status) {
      return {
        colour: 'var(--color-ink-soft)',
        label: 'Checking the channel…',
        detail: schedule,
      };
    }

    if (this.rows().some((r) => !r.success)) {
      return {
        colour: 'var(--color-overdue)',
        label: 'Last send failed',
        detail: 'The channel is configured but rejected it — see below.',
      };
    }

    if (!status.configured) {
      return {
        colour: 'var(--color-soon)',
        label: 'Teams not connected — nothing is being sent',
        detail: schedule,
      };
    }

    if (status.dryRun) {
      return {
        colour: 'var(--color-soon)',
        label: 'Dry run — rendered but not sent',
        detail: schedule,
      };
    }

    if (!status.enabled) {
      return {
        colour: 'var(--color-soon)',
        label: 'Scheduled sending is off',
        detail: `Connected to ${status.channel}, but the daily run is disabled.`,
      };
    }

    return {
      colour: 'var(--color-good)',
      label: `Connected · ${status.channel}`,
      detail: schedule,
    };
  });

  protected toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      this.api.notificationLogResource.reload();
      this.api.notificationStatusResource.reload();
    }
  }

  protected markAllRead(): void {
    const now = Date.now();
    this.seenAt.set(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
    }
  }
}

function restoreSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function relative(iso: string): string {
  const then = Date.parse(iso);
  const minutes = Math.round((Date.now() - then) / 60_000);

  if (minutes < 1) {
    return 'now';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }

  return new Date(then).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}
