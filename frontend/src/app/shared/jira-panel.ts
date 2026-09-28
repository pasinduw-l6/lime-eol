import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api,
  ApiJiraAssignee,
  ApiJiraLink,
  JiraStatusCategory,
} from '../core/api';

@Component({
  selector: 'lime-jira-panel',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="mt-4 border-t border-rule pt-4">
      @if (demo()) {
        <p
          class="m-0 mb-2.5 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px]"
          style="border-color: var(--color-soon); color: var(--color-soon)"
        >
          <span aria-hidden="true">●</span>
          Demo mode — these issues are not real and no Jira is connected.
        </p>
      }

      @if (link(); as jira) {
        @if (jira.linked) {
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <a
              class="tabular text-[13px] font-semibold text-accent-bright hover:underline"
              [href]="jira.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ jira.key }} ↗
            </a>

            @if (jira.status) {
              <span
                class="rounded-full border px-2.5 py-0.5 text-[11.5px]"
                [style.border-color]="categoryColour(jira.statusCategory)"
                [style.color]="categoryColour(jira.statusCategory)"
              >
                {{ jira.status }}
              </span>
            }

            @if (jira.assignee) {
              <span class="text-[12px] text-ink-soft">{{ jira.assignee }}</span>
            }

            @if (jira.total > 0) {
              <span class="flex items-center gap-2">
                <span class="tabular text-[12px] text-ink-soft">
                  {{ jira.done }}/{{ jira.total }} sub-tasks
                </span>
                <span class="h-1.5 w-24 overflow-hidden rounded-full bg-elevated">
                  <span
                    class="block h-full rounded-full"
                    [style.width.%]="percent()"
                    [style.background]="'var(--color-good)'"
                  ></span>
                </span>
              </span>
            }

            <span class="ml-auto flex items-center gap-3 text-[11.5px]">
              <span class="text-ink-faint">{{ syncedLabel() }}</span>
              <button
                type="button"
                class="text-accent-bright disabled:opacity-50"
                [disabled]="busy()"
                (click)="sync()"
              >
                {{ busy() ? 'Syncing…' : 'Sync' }}
              </button>
              <button type="button" class="text-ink-faint hover:text-overdue" (click)="unlink()">
                Unlink
              </button>
            </span>
          </div>

          @if (jira.syncError) {
            <p
              class="m-0 mt-2 rounded-xl border px-3 py-2 text-[12px]"
              style="border-color: var(--color-overdue); color: var(--color-overdue)"
              role="alert"
            >
              Last sync failed: {{ jira.syncError }}
            </p>
          }

          @if (jira.subtasks.length > 0) {
            <ul class="m-0 mt-3 list-none space-y-px p-0">
              @for (task of jira.subtasks; track task.key) {
                <li>
                  <a
                    class="grid items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-elevated"
                    style="grid-template-columns: 78px minmax(0, 1fr) auto auto"
                    [href]="task.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="tabular text-[11.5px] text-ink-soft">{{ task.key }}</span>
                    <span
                      class="truncate text-[12.5px]"
                      [class.text-ink-faint]="task.statusCategory === 'done'"
                      [class.line-through]="task.statusCategory === 'done'"
                    >
                      {{ task.summary }}
                    </span>
                    <span class="text-[11px] text-ink-faint">{{ task.assignee ?? '—' }}</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10.5px]"
                      [style.color]="categoryColour(task.statusCategory)"
                      [style.background]="categoryTint(task.statusCategory)"
                    >
                      {{ task.status }}
                    </span>
                  </a>
                </li>
              }
            </ul>
          } @else if (!jira.syncError) {
            <p class="m-0 mt-3 text-[12px] text-ink-faint">
              No steps on this issue yet.
            </p>
          }

          @if (!jira.syncError) {
            <form
              class="mt-2 grid items-center gap-2"
              style="grid-template-columns: minmax(0, 1fr) 150px 140px auto"
              (submit)="addStep($event)"
            >
              <input
                class="input mt-0"
                [(ngModel)]="newSummary"
                name="stepsummary"
                placeholder="Add a step in Jira"
                [disabled]="adding()"
              />
              <select
                class="input mt-0"
                [(ngModel)]="newAssignee"
                name="stepassignee"
                [disabled]="adding()"
                aria-label="Assign to"
              >
                <option value="">Unassigned</option>
                @for (person of assignees(); track person.id) {
                  <option [value]="person.id">{{ person.name }}</option>
                }
              </select>
              <input
                class="input mt-0"
                type="date"
                [(ngModel)]="newDue"
                name="stepdue"
                [disabled]="adding()"
                aria-label="Due date"
                title="Due date"
              />
              <button type="submit" class="btn" [disabled]="adding()">
                {{ adding() ? 'Adding…' : 'Add' }}
              </button>
            </form>
          }
        } @else {
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[12.5px] text-ink-soft">
              The work for this upgrade is tracked in Jira.
            </span>

            @if (connected()) {
              <form class="ml-auto flex items-center gap-2" (submit)="submitLink($event)">
                <input
                  class="input tabular mt-0 w-[150px]"
                  [(ngModel)]="issueKey"
                  name="issuekey"
                  [placeholder]="demo() ? 'DEMO-101' : 'OPS-1042'"
                  aria-label="Jira issue key"
                />
                <button type="submit" class="btn" [disabled]="busy()">
                  {{ busy() ? 'Linking…' : 'Link issue' }}
                </button>
              </form>
            } @else {
              <span class="ml-auto text-[11.5px] text-ink-faint">
                Jira is not connected — {{ statusDetail() }}
              </span>
            }
          </div>

          @if (demo()) {
            <p class="m-0 mt-2 text-[11.5px] text-ink-faint">
              Try <span class="tabular">DEMO-101</span> for a worked example, or
              <span class="tabular">DEMO-404</span> to see how a broken link reports itself.
            </p>
          }

          @if (missing().length > 0 && !demo()) {
            <p class="m-0 mt-2 text-[11.5px] text-ink-faint">
              Still to set in <span class="tabular">.env</span>:
              <span class="tabular">{{ missing().join(', ') }}</span>
            </p>
          }
        }
      }

      @if (error()) {
        <p class="m-0 mt-2 text-[12px] text-overdue" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class JiraPanel {
  private readonly api = inject(Api);

  readonly actionId = input.required<string>();

  protected readonly link = signal<ApiJiraLink | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly issueKey = signal('');

  protected readonly assignees = signal<ApiJiraAssignee[]>([]);
  protected readonly adding = signal(false);
  protected readonly newSummary = signal('');
  protected readonly newAssignee = signal('');
  protected readonly newDue = signal('');

  protected readonly connected = computed(
    () => this.api.jiraStatusResource.value()?.configured ?? false,
  );

  protected readonly statusDetail = computed(
    () => this.api.jiraStatusResource.value()?.detail ?? 'checking…',
  );

  protected readonly demo = computed(
    () => this.api.jiraStatusResource.value()?.demo ?? false,
  );

  protected readonly missing = computed(
    () => this.api.jiraStatusResource.value()?.missing ?? [],
  );

  protected readonly percent = computed(() => {
    const jira = this.link();
    if (!jira || jira.total === 0) {
      return 0;
    }
    return Math.round((jira.done / jira.total) * 100);
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api.jiraLink(this.actionId()).subscribe({
      next: (link) => {
        this.link.set(link);
        if (link.linked) {
          this.loadAssignees();
        }
      },
    });
  }

  private loadAssignees(): void {
    this.api.jiraAssignees(this.actionId()).subscribe({
      next: (people) => this.assignees.set(people),
    });
  }

  protected addStep(event: Event): void {
    event.preventDefault();
    const summary = this.newSummary().trim();
    if (!summary) {
      return;
    }

    this.adding.set(true);
    this.error.set(null);
    this.api
      .addJiraSubtask(this.actionId(), {
        summary,
        assigneeId: this.newAssignee() || undefined,
        dueDate: this.newDue() || undefined,
      })
      .subscribe({
        next: (link) => {
          this.link.set(link);
          this.newSummary.set('');
          this.newAssignee.set('');
          this.newDue.set('');
          this.adding.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.adding.set(false);
          this.error.set(err.error?.message ?? 'Could not add that step.');
        },
      });
  }

  protected submitLink(event: Event): void {
    event.preventDefault();
    const key = this.issueKey().trim();
    if (!key) {
      return;
    }

    this.run(this.api.linkJiraIssue(this.actionId(), key), () =>
      this.issueKey.set(''),
    );
  }

  protected sync(): void {
    this.run(this.api.syncJiraIssue(this.actionId()));
  }

  protected unlink(): void {
    this.run(this.api.unlinkJiraIssue(this.actionId()));
  }

  private run(
    request: ReturnType<Api['jiraLink']>,
    after?: () => void,
  ): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (link) => {
        this.link.set(link);
        this.busy.set(false);
        if (link.linked) {
          this.loadAssignees();
        } else {
          this.assignees.set([]);
        }
        after?.();
      },
      error: (err: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.error.set(err.error?.message ?? 'That did not work.');
      },
    });
  }

  protected categoryColour(category: JiraStatusCategory | null): string {
    switch (category) {
      case 'done':
        return 'var(--color-good)';
      case 'in-progress':
        return 'var(--color-accent-bright)';
      case 'to-do':
        return 'var(--color-ink-soft)';
      default:
        return 'var(--color-ink-faint)';
    }
  }

  protected categoryTint(category: JiraStatusCategory | null): string {
    return `color-mix(in oklab, ${this.categoryColour(category)} 16%, transparent)`;
  }

  protected syncedLabel(): string {
    const at = this.link()?.syncedAt;
    if (!at) {
      return 'never synced';
    }

    const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
    if (minutes < 1) {
      return 'synced just now';
    }
    if (minutes < 60) {
      return `synced ${minutes} min ago`;
    }

    const hours = Math.round(minutes / 60);
    return hours < 24 ? `synced ${hours} h ago` : `synced ${Math.round(hours / 24)} d ago`;
  }
}
