import { Component, computed, inject, signal } from '@angular/core';
import { NotificationPreview } from '../features/notifications/notification-preview';
import { SAMPLE_LOG, SampleSend } from '../features/notifications/sample-log';
import { TechIcon } from './tech-icon';

const SEEN_KEY = 'lime.notifications.seen';

interface Row extends SampleSend {
  id: string;
  unread: boolean;
  when: string;
}

/**
 * The bell, and what it drops down.
 *
 * A log of what this tool announced, not a page about notifications. Follows
 * the pattern every web tool has settled on — newest first, unread in bold,
 * relative times for recent entries and absolute ones for older, a count that
 * means "new since you last looked", and one place to clear it.
 *
 * The channel status stays in the header of the panel rather than a settings
 * screen: a drawer should not be the only place something important is said,
 * and "not connected" is important.
 */
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
      <!-- click anywhere else to dismiss -->
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
            <button
              type="button"
              class="text-[12px] text-accent-bright"
              (click)="markAllRead()"
            >
              Mark all read
            </button>
          }
        </header>

        <!-- what the next run holds, and whether it can even send -->
        <div class="border-b border-rule px-4 py-2.5 text-[12px]">
          <p class="m-0 flex items-center gap-2 text-ink-soft">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              style="background: var(--color-soon)"
              aria-hidden="true"
            ></span>
            Teams not connected — nothing is being sent
          </p>
          <p class="m-0 mt-0.5 text-ink-faint">
            {{ preview.pending().length }} would go out on the next run, 08:00 daily
          </p>
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
                <span
                  class="block truncate text-[13px]"
                  [class.font-semibold]="row.unread"
                >
                  {{ row.technology }} {{ row.cycle }}
                </span>
                <span class="block text-[12px] text-ink-soft">
                  {{ row.threshold === 0 ? 'End of life' : row.threshold + '-day notice' }}
                  · {{ row.note }}
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
              Nothing has been sent yet.
            </li>
          }
        </ol>

        <footer class="border-t border-rule px-4 py-2 text-[11px] text-ink-faint">
          Sample history — delivery is not wired up yet.
        </footer>
      </div>
    }
  `,
})
export class NotificationMenu {
  protected readonly preview = inject(NotificationPreview);

  protected readonly open = signal(false);
  private readonly seenAt = signal<number>(restoreSeen());

  protected readonly rows = computed<Row[]>(() =>
    // Newest first, which is what everyone expects and what makes the count
    // mean anything.
    [...SAMPLE_LOG]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .map((entry) => ({
        ...entry,
        id: entry.at + entry.technology,
        unread: Date.parse(entry.at) > this.seenAt(),
        when: relative(entry.at),
      })),
  );

  protected readonly unreadCount = computed(
    () => this.rows().filter((r) => r.unread).length,
  );

  /** A failed send turns the badge red: it is not just new, it is wrong. */
  protected readonly hasFailure = computed(() =>
    this.rows().some((r) => r.unread && !r.success),
  );

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected markAllRead(): void {
    const now = Date.now();
    this.seenAt.set(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      // Site data blocked. Cleared for this tab, back next reload — better
      // than refusing to clear at all.
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

/** Relative while it is recent, absolute once it stops being "ago". */
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
