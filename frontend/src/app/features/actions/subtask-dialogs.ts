import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import {
  Api,
  ApiJiraAssignee,
  ApiJiraSubtask,
  ApiJiraTransition,
  ApiJiraWorklog,
  ApiUpgradeAction,
} from '../../core/api';
import { formatDate } from '../../core/lifecycle';
import { Feedback } from '../../core/feedback';
import { GanttJiraEvent, GanttSubEvent, GanttSubReschedule, todayIso } from '../../shared/gantt';
import { Modal } from '../../shared/modal';

interface SubForm {
  planId: string;
  key: string | null;
  summary: string;
  assigneeId: string;
  currentAssignee: string | null;
  startDate: string;
  dueDate: string;
  estimate: string;
  assignees: ApiJiraAssignee[];
}

interface LogForm {
  planId: string;
  key: string;
  summary: string;
  time: string;
  date: string;
  comment: string;
  spent: number | null;
  estimate: number | null;
  logs: ApiJiraWorklog[] | null;
}

interface StatusForm {
  planId: string;
  key: string;
  summary: string;
  current: string;
  transitions: ApiJiraTransition[] | null;
}

@Component({
  selector: 'lime-subtask-dialogs',
  imports: [FormsModule, HlmButton, HlmInput, HlmLabel, Modal],
  template: `
    @if (sub(); as form) {
      <lime-modal
        [title]="form.key ? 'Edit ' + form.key : 'Add a sub-task'"
        [subtitle]="form.key ? 'Saved straight to Jira.' : planKey(form.planId) ? 'Created under ' + planKey(form.planId) + ' in Jira.' : 'This plan has no Jira issue yet. One is created on the project board first, then this sub-task under it.'"
        (dismiss)="sub.set(null)"
      >
        <form class="grid gap-4" (submit)="saveSub($event)">
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Title
            <input hlmInput [(ngModel)]="form.summary" name="summary" required maxlength="255" placeholder="Run the upgrade on UAT" />
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Assignee
              <select hlmInput [(ngModel)]="form.assigneeId" name="assignee">
                <option value="">{{ form.currentAssignee && !form.assigneeId ? form.currentAssignee + ' (keep)' : 'Unassigned' }}</option>
                @for (a of form.assignees; track a.id) {
                  <option [value]="a.id">{{ a.name }}</option>
                }
              </select>
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Estimate
              <input hlmInput [(ngModel)]="form.estimate" name="estimate" placeholder="4h, 1d, 2h 30m" />
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Start date
              <input hlmInput type="date" [(ngModel)]="form.startDate" name="start" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Due date
              <input hlmInput type="date" [(ngModel)]="form.dueDate" name="due" />
            </label>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="sub.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ busy() ? 'Saving…' : form.key ? 'Save to Jira' : 'Create in Jira' }}</button>
          </div>
        </form>
      </lime-modal>
    }

    @if (log(); as form) {
      <lime-modal [title]="'Log time · ' + form.key" [subtitle]="form.summary" (dismiss)="log.set(null)">
        <form class="grid gap-4" (submit)="saveLog($event)">
          <p class="m-0 text-[13px] text-muted-foreground">
            Logged so far: <strong class="text-foreground">{{ hours(form.spent) }}</strong>
            @if (form.estimate) {
              of {{ hours(form.estimate) }} estimated
            }
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Time spent
              <input hlmInput [(ngModel)]="form.time" name="time" required placeholder="1h 30m" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Date worked
              <input hlmInput type="date" [(ngModel)]="form.date" name="date" required />
            </label>
          </div>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            What was done
            <textarea hlmInput rows="2" class="h-auto py-2" [(ngModel)]="form.comment" name="comment" placeholder="Optional"></textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="log.set(null)">Close</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ busy() ? 'Logging…' : 'Log time in Jira' }}</button>
          </div>
        </form>

        <section class="mt-5 border-t pt-4">
          <h3 class="m-0 mb-2 text-[13px] font-semibold">Time log</h3>
          @if (form.logs === null) {
            <p class="m-0 text-[13px] text-muted-foreground">Loading…</p>
          } @else {
            <ul class="m-0 grid max-h-[200px] list-none gap-2 overflow-y-auto p-0 text-[13px]">
              @for (entry of form.logs; track entry.id) {
                <li class="flex gap-3">
                  <span class="w-[64px] shrink-0 font-medium tabular">{{ hours(entry.seconds) }}</span>
                  <span class="min-w-0 flex-1">
                    {{ entry.author }} · {{ date(entry.started.slice(0, 10)) }}
                    @if (entry.comment) {
                      <span class="block truncate text-muted-foreground" [title]="entry.comment">{{ entry.comment }}</span>
                    }
                  </span>
                </li>
              } @empty {
                <li class="text-muted-foreground">No time logged yet.</li>
              }
            </ul>
          }
        </section>
      </lime-modal>
    }

    @if (status(); as form) {
      <lime-modal [title]="'Change status · ' + form.key" [subtitle]="form.summary + ' — now ' + form.current" (dismiss)="status.set(null)">
        @if (form.transitions === null) {
          <p class="m-0 text-[13px] text-muted-foreground">Asking Jira which statuses are allowed…</p>
        } @else {
          <div class="grid gap-2">
            @for (t of form.transitions; track t.id) {
              <button type="button" hlmBtn variant="outline" class="justify-between" [disabled]="busy()" (click)="applyTransition(form, t)">
                <span>{{ t.name }}</span>
                <span class="text-[12px] text-muted-foreground">→ {{ t.to }}</span>
              </button>
            } @empty {
              <p class="m-0 text-[13px] text-muted-foreground">Jira allows no status change from here.</p>
            }
          </div>
        }
      </lime-modal>
    }

    @if (link(); as form) {
      <lime-modal title="Link a Jira issue" subtitle="Its sub-tasks will show under this plan." (dismiss)="link.set(null)">
        <form class="grid gap-4" (submit)="saveLink($event)">
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Issue key
            <input hlmInput class="uppercase" [(ngModel)]="form.key" name="key" required placeholder="KAN-12" />
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="link.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ busy() ? 'Linking…' : 'Link' }}</button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class SubtaskDialogs {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);

  protected readonly sub = signal<SubForm | null>(null);
  protected readonly log = signal<LogForm | null>(null);
  protected readonly status = signal<StatusForm | null>(null);
  protected readonly link = signal<{ planId: string; key: string } | null>(null);
  protected readonly busy = signal(false);

  protected readonly date = formatDate;

  onJira(event: GanttJiraEvent): void {
    const plan = this.plan(event.planId);
    if (!plan) return;

    if (event.action === 'link') {
      this.link.set({ planId: plan.id, key: '' });
      return;
    }

    if (event.action === 'add') {
      this.openSub(plan, null);
      return;
    }

    void this.feedback
      .confirm({
        title: `Create a Jira issue for ${plan.technology} ${plan.cycle}?`,
        message: 'It goes to the board linked to this project (or the server default), with a sub-task per environment.',
        confirmLabel: 'Create in Jira',
      })
      .then((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.api.createJiraIssue(plan.id).subscribe({
          next: (result) => this.done(`Created ${result.key} with ${result.total} sub-task(s).`),
          error: (err) => this.fail(err, 'Could not create the Jira issue.'),
        });
      });
  }

  onSub(event: GanttSubEvent): void {
    const plan = this.plan(event.planId);
    const task = plan?.subtasks.find((s) => s.key === event.key);
    if (!plan || !task) return;

    switch (event.action) {
      case 'open':
        window.open(task.url, '_blank', 'noopener');
        break;
      case 'edit':
        this.openSub(plan, task);
        break;
      case 'log':
        this.openLog(plan, task);
        break;
      case 'status':
        this.openStatus(plan, task);
        break;
    }
  }

  reschedule(change: GanttSubReschedule): void {
    this.api
      .updateJiraSubtask(change.planId, change.key, { startDate: change.start, dueDate: change.end })
      .subscribe({
        next: () => {
          this.api.actionsResource.reload();
          this.feedback.success(`${change.key} moved to ${formatDate(change.start)} – ${formatDate(change.end)} in Jira.`);
        },
        error: (err) => this.feedback.failed(err, `Could not move ${change.key}.`),
      });
  }

  protected planKey(planId: string): string | null {
    return this.plan(planId)?.jiraKey ?? null;
  }

  private openSub(plan: ApiUpgradeAction, task: ApiJiraSubtask | null): void {
    this.sub.set({
      planId: plan.id,
      key: task?.key ?? null,
      summary: task?.summary ?? '',
      assigneeId: '',
      currentAssignee: task?.assignee ?? null,
      startDate: task?.startDate ?? '',
      dueDate: task?.dueDate ?? plan.plannedDate ?? '',
      estimate: task?.estimateSeconds ? this.hours(task.estimateSeconds).replace(/\s/g, ' ') : '',
      assignees: [],
    });

    this.api.jiraAssignees(plan.id).subscribe({
      next: (assignees) => {
        const form = this.sub();
        if (!form || form.planId !== plan.id) return;
        const match = assignees.find((a) => a.name === form.currentAssignee);
        this.sub.set({ ...form, assignees, assigneeId: match?.id ?? form.assigneeId });
      },
    });
  }

  private openLog(plan: ApiUpgradeAction, task: ApiJiraSubtask): void {
    this.log.set({
      planId: plan.id,
      key: task.key,
      summary: task.summary,
      time: '',
      date: todayIso(),
      comment: '',
      spent: task.spentSeconds,
      estimate: task.estimateSeconds,
      logs: null,
    });
    this.loadLogs(plan.id, task.key);
  }

  private loadLogs(planId: string, key: string): void {
    this.api.subtaskWorklogs(planId, key).subscribe({
      next: (logs) => {
        const form = this.log();
        if (form?.key === key) this.log.set({ ...form, logs });
      },
      error: (err) => {
        const form = this.log();
        if (form?.key === key) this.log.set({ ...form, logs: [] });
        this.feedback.failed(err, 'Could not read the time log.');
      },
    });
  }

  private openStatus(plan: ApiUpgradeAction, task: ApiJiraSubtask): void {
    this.status.set({ planId: plan.id, key: task.key, summary: task.summary, current: task.status, transitions: null });
    this.api.subtaskTransitions(plan.id, task.key).subscribe({
      next: (transitions) => {
        const form = this.status();
        if (form?.key === task.key) this.status.set({ ...form, transitions });
      },
      error: (err) => {
        this.status.set(null);
        this.feedback.failed(err, 'Could not read the statuses from Jira.');
      },
    });
  }

  protected saveSub(event: Event): void {
    event.preventDefault();
    const form = this.sub();
    if (!form || !form.summary.trim()) return;

    this.busy.set(true);
    const request = form.key
      ? this.api.updateJiraSubtask(form.planId, form.key, {
          summary: form.summary.trim(),
          ...(form.assigneeId ? { assigneeId: form.assigneeId } : {}),
          startDate: form.startDate || null,
          dueDate: form.dueDate || null,
          ...(form.estimate.trim() ? { estimate: form.estimate.trim() } : {}),
        })
      : this.api.addJiraSubtask(form.planId, {
          summary: form.summary.trim(),
          ...(form.assigneeId ? { assigneeId: form.assigneeId } : {}),
          ...(form.startDate ? { startDate: form.startDate } : {}),
          ...(form.dueDate ? { dueDate: form.dueDate } : {}),
          ...(form.estimate.trim() ? { estimate: form.estimate.trim() } : {}),
        });

    request.subscribe({
      next: () => {
        this.sub.set(null);
        this.done(form.key ? `${form.key} saved in Jira.` : 'Sub-task created in Jira.');
      },
      error: (err) => this.fail(err, 'Jira did not accept that.'),
    });
  }

  protected saveLog(event: Event): void {
    event.preventDefault();
    const form = this.log();
    if (!form || !form.time.trim()) return;

    this.busy.set(true);
    this.api
      .logSubtaskWork(form.planId, form.key, {
        time: form.time.trim(),
        date: form.date,
        ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
      })
      .subscribe({
        next: (mirror) => {
          const task = mirror.subtasks.find((s) => s.key === form.key) as ApiJiraSubtask | undefined;
          this.log.set({ ...form, time: '', comment: '', spent: task?.spentSeconds ?? form.spent, logs: null });
          this.loadLogs(form.planId, form.key);
          this.done(`${form.time.trim()} logged on ${form.key}.`);
        },
        error: (err) => this.fail(err, 'Could not log that time.'),
      });
  }

  protected applyTransition(form: StatusForm, transition: ApiJiraTransition): void {
    this.busy.set(true);
    this.api.transitionSubtask(form.planId, form.key, transition.id).subscribe({
      next: () => {
        this.status.set(null);
        this.done(`${form.key} is now ${transition.to}.`);
      },
      error: (err) => this.fail(err, 'Jira refused that status change.'),
    });
  }

  protected saveLink(event: Event): void {
    event.preventDefault();
    const form = this.link();
    if (!form || !form.key.trim()) return;

    this.busy.set(true);
    this.api.linkJiraIssue(form.planId, form.key.trim().toUpperCase()).subscribe({
      next: (result) => {
        this.link.set(null);
        this.done(`Linked to ${result.key} · ${result.total} sub-task(s).`);
      },
      error: (err) => this.fail(err, 'Could not link that issue.'),
    });
  }

  protected hours(seconds: number | null): string {
    if (!seconds) return '0h';
    const minutes = Math.round(seconds / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
  }

  private plan(id: string): ApiUpgradeAction | undefined {
    return this.api.actions().find((a) => a.id === id);
  }

  private done(message: string): void {
    this.busy.set(false);
    this.api.actionsResource.reload();
    this.feedback.success(message);
  }

  private fail(err: unknown, fallback: string): void {
    this.busy.set(false);
    this.feedback.failed(err, fallback);
  }
}
