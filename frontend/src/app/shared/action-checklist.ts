import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiActionStep } from '../core/api';
import { RegistryStore } from '../core/registry.store';
import { noteExcerpt, renderNote } from '../core/note-markdown';
import { NoteEditor } from './note-editor';

/** Where the opened note grew from, so it expands out of the one clicked. */
interface Origin {
  x: number;
  y: number;
  scale: number;
}

/**
 * The to-do list on an upgrade, as a board of pinned paper notes.
 *
 * A list read as history — a record of what happened. Notes on a board read as
 * work waiting to be picked up, which is what a plan is.
 *
 * The notes are paper in both themes rather than glass like the rest of the
 * app: the board is the one surface here that is meant to feel physical.
 *
 * Two faces, doing two jobs. Plex Mono carries what a person wrote — the title
 * and the note — so it reads as a typed index card, and so the version strings,
 * config keys and hostnames these notes are full of render exactly rather than
 * approximately. Plex Sans carries what the system knows: owners, dates,
 * effort, buttons. Keeping those apart is what gives the board its register
 * without resorting to a novelty face.
 */
@Component({
  selector: 'lime-action-checklist',
  imports: [FormsModule, NoteEditor],
  host: {
    class: 'block',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <div class="mt-4 border-t border-rule pt-4">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
        <span class="flex items-baseline gap-3">
          <h3 class="m-0 text-[13px] font-semibold">To-do list</h3>
          @if (steps().length > 0) {
            <span class="tabular text-[12px] text-ink-soft">
              {{ doneCount() }}/{{ steps().length }} done
              @if (spent() > 0) {
                · {{ effort(spent()) }} spent
              }
            </span>
          }
        </span>
      </div>

      <div class="board rounded-[16px] border border-rule p-4" role="list" aria-label="Steps">
        <div class="flex flex-wrap gap-3.5">
          @for (step of steps(); track step.id) {
            <article
              role="listitem"
              class="note relative flex w-[210px] cursor-pointer flex-col"
              [class.is-done]="step.status === 'DONE'"
              [style.--paper]="paper(step)"
              [style.--tilt]="tiltFor($index)"
              [style.animation-delay.ms]="$index * 45"
              [attr.aria-label]="step.title"
              (click)="open(step, $event)"
            >
              <!-- the pin -->
              <span
                class="pin absolute -top-1 left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full"
                [style.background]="dotColour(step)"
                aria-hidden="true"
              ></span>

              <span class="flex min-h-[132px] flex-1 flex-col gap-1 px-3.5 pt-5 pb-2.5">
                <span class="note-title line-clamp-3 text-[13.5px] leading-[1.35]">
                  {{ step.title }}
                </span>

                @if (excerpt(step); as text) {
                  <span class="note-body line-clamp-2 text-[12px] leading-[1.45]">
                    {{ text }}
                  </span>
                }

                <span class="meta mt-auto flex items-baseline justify-between gap-2 pt-1.5">
                  <span class="truncate text-[10.5px]">
                    @if (step.assignee) {
                      {{ step.assignee.name }}
                    } @else {
                      unassigned
                    }
                  </span>
                  <span class="tabular shrink-0 text-[10.5px]">
                    @if (step.dueDate && step.status !== 'DONE') {
                      <span [class.late]="step.overdue">{{ shortDate(step.dueDate) }}</span>
                    } @else if (step.spentMinutes > 0) {
                      {{ effort(step.spentMinutes) }}
                    }
                  </span>
                </span>
              </span>

              <span class="meta flex items-center justify-between gap-1 px-3 pb-2 text-[11px]">
                @if (step.status === 'DONE') {
                  <button type="button" class="link" (click)="reopen(step, $event)">Reopen</button>
                } @else {
                  <span class="flex gap-2.5">
                    @if (!step.running) {
                      <button type="button" class="link" (click)="start(step, $event)">Start</button>
                    }
                    <button type="button" class="link" (click)="complete(step, $event)">Done</button>
                  </span>
                }
                <span class="text-[10px] opacity-55">open</span>
              </span>
            </article>
          } @empty {
            <p class="meta m-0 px-1 py-6 text-[12.5px]">
              Nothing pinned yet. Add the first step below.
            </p>
          }
        </div>
      </div>

      @if (error()) {
        <p class="m-0 mt-2 text-[12px] text-overdue" role="alert">{{ error() }}</p>
      }

      <!-- add a step: one row, columns sized to what each part needs -->
      <form
        class="mt-3 grid items-center gap-2"
        style="grid-template-columns: minmax(0, 1fr) 150px 150px auto"
        (submit)="add($event)"
      >
        <input class="input mt-0" [(ngModel)]="title" name="steptitle" placeholder="Add a step" />
        <select class="input mt-0" [(ngModel)]="assigneeId" name="stepassignee">
          <option value="">Unassigned</option>
          @for (e of engineers(); track e.id) {
            <option [value]="e.id">{{ e.name }}</option>
          }
        </select>
        <input
          class="input mt-0"
          type="date"
          [(ngModel)]="dueDate"
          name="stepdue"
          aria-label="Finish by"
          title="Finish by"
        />
        <button type="submit" class="btn btn-primary" [disabled]="busy()">Add</button>
      </form>
    </div>

    <!-- the note, taken off the board and read up close -->
    @if (opened(); as step) {
      <div
        class="sheet-scrim fixed inset-0 z-50 grid place-items-center p-4"
        (click)="close()"
      >
        <section
          class="sheet flex max-h-[86vh] w-full max-w-[580px] flex-col overflow-hidden"
          [style.--paper]="paper(step)"
          [style.--from-x.px]="origin().x"
          [style.--from-y.px]="origin().y"
          [style.--from-scale]="origin().scale"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="step.title"
          (click)="$event.stopPropagation()"
        >
          <header class="flex items-start gap-3 px-6 pt-5">
            <input
              class="note-title sheet-title min-w-0 flex-1 text-[18px] leading-snug"
              [(ngModel)]="draftTitle"
              name="sheettitle"
              placeholder="What needs doing"
              aria-label="Title"
            />
            <button
              type="button"
              class="meta shrink-0 text-[18px] leading-none opacity-55 hover:opacity-100"
              aria-label="Close"
              (click)="close()"
            >
              ✕
            </button>
          </header>

          <p class="meta m-0 px-6 pt-1.5 text-[11.5px]">
            {{ statusLabel(step) }}
            @if (step.spentMinutes > 0) {
              · {{ effort(step.spentMinutes) }} spent
            }
            @if (step.completedAt) {
              · finished {{ when(step.completedAt) }}
            } @else if (step.startedAt) {
              · started {{ when(step.startedAt) }}
            }
          </p>

          <div class="sheet-body min-h-0 flex-1 overflow-y-auto px-6 py-4">
            @if (editing()) {
              <lime-note-editor
                [(value)]="draftBody"
                [minHeight]="220"
                [maxHeight]="460"
                [note]="true"
                placeholder="The detail — what to check, what to watch for, who to tell."
              />
            } @else {
              <div
                class="note-read note-body text-[13.5px] leading-[1.65]"
                [innerHTML]="bodyHtml()"
              ></div>
              @if (!step.description) {
                <p class="meta m-0 text-[12.5px] italic">
                  No detail yet. Use Edit to write the long version.
                </p>
              }
            }
          </div>

          <div class="sheet-foot grid gap-3 px-6 py-4">
            <div class="grid gap-3" style="grid-template-columns: minmax(0, 1fr) 160px">
              <label class="meta block text-[11px]">
                Owner
                <select
                  class="paper-input mt-1 w-full"
                  [(ngModel)]="draftAssignee"
                  name="sheetassignee"
                >
                  <option value="">Unassigned</option>
                  @for (e of engineers(); track e.id) {
                    <option [value]="e.id">{{ e.name }}</option>
                  }
                </select>
              </label>
              <label class="meta block text-[11px]">
                Finish by
                <input
                  class="paper-input tabular mt-1 w-full"
                  type="date"
                  [(ngModel)]="draftDue"
                  name="sheetdue"
                />
              </label>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              @if (editing()) {
                <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save(step)">
                  {{ saving() ? 'Saving…' : 'Save' }}
                </button>
                <button type="button" class="btn" (click)="cancelEdit(step)">Cancel</button>
              } @else {
                <button type="button" class="btn btn-primary" (click)="editing.set(true)">
                  Edit
                </button>
                @if (step.status === 'DONE') {
                  <button type="button" class="btn" (click)="reopen(step, $event)">Reopen</button>
                } @else {
                  @if (!step.running) {
                    <button type="button" class="btn" (click)="start(step, $event)">Start</button>
                  }
                  <button type="button" class="btn" (click)="complete(step, $event)">Done</button>
                }
              }

              <button
                type="button"
                class="meta ml-auto text-[11.5px] underline decoration-dotted hover:text-overdue"
                (click)="remove(step)"
              >
                Delete note
              </button>
            </div>

            @if (sheetError()) {
              <p class="m-0 text-[12px] text-overdue" role="alert">{{ sheetError() }}</p>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    /* The board: a recessed panel, not a photograph of cork. The paper arrives
       through colour and shadow rather than a pasted-in texture. */
    .board {
      background:
        radial-gradient(
          circle at 1px 1px,
          color-mix(in oklab, var(--color-ink) 9%, transparent) 1px,
          transparent 0
        );
      background-size: 7px 7px;
      box-shadow: inset 0 2px 10px rgb(0 0 0 / 22%);
    }

    :root[data-theme='light'] .board {
      box-shadow: inset 0 2px 10px rgb(13 36 48 / 10%);
    }

    /* Paper is paper in both themes, so its own ink colours are fixed here
       rather than taken from the theme. */
    .note,
    .sheet {
      --paper-ink: #2c2a24;
      /* Ribbon ink: near-black with enough blue to read as written on, not
         printed by the application. */
      --paper-text: #22303d;
      --paper-meta: #6b6355;
      --paper-rule: rgb(44 42 36 / 14%);

      background:
        /* a faint diagonal sheen, as if light crosses the sheet */
        linear-gradient(
          118deg,
          rgb(255 255 255 / 42%) 0%,
          rgb(255 255 255 / 4%) 38%,
          rgb(0 0 0 / 3%) 100%
        ),
        /* fibre: two offset hairline grids, far too faint to read as stripes */
        repeating-linear-gradient(
          92deg,
          rgb(0 0 0 / 2.5%) 0 1px,
          transparent 1px 4px
        ),
        repeating-linear-gradient(
          2deg,
          rgb(0 0 0 / 1.8%) 0 1px,
          transparent 1px 5px
        ),
        var(--paper);
      color: var(--paper-ink);
    }

    .note {
      border-radius: 2px 10px 3px 8px;
      transform: rotate(var(--tilt));
      /* Bottom-heavy: paper pinned at the top lifts away from the board below. */
      box-shadow:
        0 1px 1px rgb(0 0 0 / 16%),
        0 10px 16px -10px rgb(0 0 0 / 52%);
      transition:
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
        box-shadow 220ms cubic-bezier(0.32, 0.72, 0, 1);
      animation: note-pin 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    /* Lifts off the board and straightens under the cursor. */
    .note:hover {
      transform: rotate(0deg) translateY(-3px);
      box-shadow:
        0 2px 3px rgb(0 0 0 / 18%),
        0 18px 28px -12px rgb(0 0 0 / 58%);
      z-index: 1;
    }

    .note:focus-visible {
      outline: 2px solid var(--color-accent-bright);
      outline-offset: 3px;
    }

    .pin {
      box-shadow:
        inset 0 -1px 1px rgb(0 0 0 / 30%),
        inset 0 1px 1px rgb(255 255 255 / 55%),
        0 2px 3px rgb(0 0 0 / 40%);
    }

    .note.is-done .note-title {
      text-decoration: line-through;
      text-decoration-thickness: 1px;
      opacity: 0.6;
    }

    /* The title carries the weight; the body is the same face at regular, so a
       note has a hierarchy without introducing a second family. */
    .note-title {
      font-family: var(--font-note);
      color: var(--paper-text);
      font-weight: 500;
      letter-spacing: -0.2px;
    }

    .note-body {
      font-family: var(--font-note);
      color: var(--paper-text);
      font-weight: 400;
      letter-spacing: -0.1px;
    }

    /* What the system knows, in the UI face. */
    .meta {
      color: var(--paper-meta);
    }

    .meta .late {
      color: #b4342a;
      font-weight: 600;
    }

    .note .link {
      color: #1c6b52;
      font-weight: 600;
    }

    .note .link:hover {
      text-decoration: underline;
    }

    @keyframes note-pin {
      from {
        opacity: 0;
        transform: rotate(var(--tilt)) translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: rotate(var(--tilt));
      }
    }

    /* --- the note read up close --- */

    .sheet-scrim {
      background: rgb(6 12 16 / 62%);
      backdrop-filter: blur(3px);
      animation: scrim-in 180ms ease-out both;
    }

    .sheet {
      border-radius: 3px 14px 4px 12px;
      box-shadow:
        0 2px 4px rgb(0 0 0 / 22%),
        0 40px 80px -24px rgb(0 0 0 / 70%);
      /* Grows out of the note that was clicked. */
      animation: sheet-open 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes scrim-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes sheet-open {
      from {
        opacity: 0;
        transform: translate(var(--from-x), var(--from-y)) scale(var(--from-scale));
      }
      to {
        opacity: 1;
        transform: translate(0, 0) scale(1);
      }
    }

    .sheet-title {
      background: transparent;
      border: 0;
      border-bottom: 1px dashed transparent;
      outline: none;
      padding: 0 0 2px;
    }

    .sheet-title:focus {
      border-bottom-color: var(--paper-rule);
    }

    .sheet-body {
      border-top: 1px solid var(--paper-rule);
      margin-top: 12px;
    }

    .sheet-foot {
      border-top: 1px solid var(--paper-rule);
      background: rgb(0 0 0 / 3%);
    }

    /* Form controls on paper: the app's own inputs are dark glass. */
    .paper-input {
      appearance: none;
      background: rgb(255 255 255 / 55%);
      border: 1px solid var(--paper-rule);
      border-radius: 6px;
      color: var(--paper-ink);
      font: inherit;
      font-size: 12.5px;
      padding: 5px 8px;
    }

    .paper-input:focus {
      outline: none;
      border-color: color-mix(in oklab, var(--paper-text) 45%, transparent);
      background: rgb(255 255 255 / 80%);
    }

    .sheet .btn {
      border-color: var(--paper-rule);
      color: var(--paper-ink);
      background: rgb(255 255 255 / 55%);
    }

    .sheet .btn:hover {
      background: rgb(255 255 255 / 85%);
    }

    .sheet .btn-primary {
      background: #1c6b52;
      border-color: #1c6b52;
      color: #f4fbf7;
    }

    .sheet .btn-primary:hover {
      background: #185a45;
    }

    /* The editor is a glass component dropped onto paper. Its own styles read
       these tokens, so redefining them here is enough — no reaching into its
       template, which style encapsulation would not allow anyway. */
    .sheet lime-note-editor {
      --color-rule: var(--paper-rule);
      --color-ink: var(--paper-text);
      --color-ink-soft: var(--paper-meta);
      --color-ink-faint: color-mix(in oklab, var(--paper-meta) 70%, transparent);
      --color-elevated: rgb(255 255 255 / 60%);
      color: var(--paper-text);
    }

    /* --- rendered note body --- */

    .note-read :first-child {
      margin-top: 0;
    }

    .note-read :last-child {
      margin-bottom: 0;
    }

    .note-read p,
    .note-read ul,
    .note-read ol,
    .note-read blockquote {
      margin: 0 0 0.6em;
    }

    .note-read ul,
    .note-read ol {
      padding-left: 1.3em;
    }

    .note-read li {
      margin-bottom: 0.15em;
    }

    .note-read blockquote {
      border-left: 2px solid var(--paper-rule);
      padding-left: 0.8em;
      font-style: italic;
      opacity: 0.85;
    }

    .note-read strong {
      font-weight: 700;
    }

    .note-read a {
      color: #1c6b52;
      text-decoration: underline;
      text-decoration-style: dotted;
      /* URLs are long and the sheet is not wide. */
      overflow-wrap: anywhere;
    }

    /* The body is already monospace, so a code span cannot be marked out by
       family any more — it is the tint and the rule that carry it. */
    .note-read code {
      font-family: var(--font-note);
      font-size: 0.95em;
      background: rgb(0 0 0 / 6%);
      border: 1px solid var(--paper-rule);
      border-radius: 4px;
      padding: 0 4px;
      color: var(--paper-ink);
    }

    /* A name is not a literal, so it steps out into the UI face. */
    .note-read .note-mention {
      font-family: var(--font-sans);
      font-size: 0.92em;
      font-weight: 600;
      background: color-mix(in oklab, var(--paper-text) 13%, transparent);
      color: var(--paper-text);
      border-radius: 999px;
      padding: 1px 7px;
      white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) {
      .note,
      .sheet,
      .sheet-scrim {
        animation: none;
        transition: none;
      }
    }

    @media (max-width: 560px) {
      .note {
        width: 100%;
      }
    }
  `,
})
export class ActionChecklist {
  private readonly api = inject(Api);
  private readonly store = inject(RegistryStore);

  readonly actionId = input.required<string>();

  protected readonly engineers = this.store.engineers;

  protected readonly steps = signal<ApiActionStep[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly title = signal('');
  protected readonly dueDate = signal('');
  protected readonly assigneeId = signal('');

  /** Which note is off the board, by id — so it survives the list reloading. */
  private readonly openId = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly sheetError = signal<string | null>(null);
  protected readonly origin = signal<Origin>({ x: 0, y: 0, scale: 0.4 });

  protected readonly draftTitle = signal('');
  protected readonly draftBody = signal('');
  protected readonly draftAssignee = signal('');
  protected readonly draftDue = signal('');

  protected readonly opened = computed(() => {
    const id = this.openId();
    return id ? (this.steps().find((s) => s.id === id) ?? null) : null;
  });

  private readonly mentionNames = computed(() => this.engineers().map((e) => e.name));

  protected readonly bodyHtml = computed(() =>
    renderNote(this.opened()?.description ?? null, this.mentionNames()),
  );

  protected readonly doneCount = computed(
    () => this.steps().filter((s) => s.status === 'DONE').length,
  );

  /** Effort recorded so far, across every stretch of work. */
  protected readonly spent = computed(() =>
    this.steps().reduce((total, s) => total + s.spentMinutes, 0),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api.actionSteps(this.actionId()).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  /**
   * Two lines of the note, for the face.
   *
   * 55 rather than 80: monospace has a fixed advance, so a 210px note holds
   * about 25 characters a line and a longer string would only be clipped again
   * by the line clamp — with two competing ellipses.
   */
  protected excerpt(step: ApiActionStep): string {
    return noteExcerpt(step.description, 55);
  }

  /** Takes the note off the board, expanding it from where it was pinned. */
  protected open(step: ApiActionStep, event: Event): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.origin.set({
      x: Math.round(rect.left + rect.width / 2 - window.innerWidth / 2),
      y: Math.round(rect.top + rect.height / 2 - window.innerHeight / 2),
      scale: Math.max(0.2, Math.min(1, rect.width / 580)),
    });

    this.seed(step);
    this.editing.set(false);
    this.sheetError.set(null);
    this.openId.set(step.id);
  }

  protected close(): void {
    this.openId.set(null);
    this.editing.set(false);
    this.sheetError.set(null);
  }

  private seed(step: ApiActionStep): void {
    this.draftTitle.set(step.title);
    this.draftBody.set(step.description ?? '');
    this.draftAssignee.set(step.assignee?.id ?? '');
    this.draftDue.set(step.dueDate ?? '');
  }

  protected cancelEdit(step: ApiActionStep): void {
    this.seed(step);
    this.editing.set(false);
    this.sheetError.set(null);
  }

  /**
   * Explicit save rather than save-on-close.
   *
   * A long note written and then lost to a stray click outside is the one
   * failure this whole surface exists to avoid.
   */
  protected save(step: ApiActionStep): void {
    const title = this.draftTitle().trim();
    if (!title) {
      this.sheetError.set('A note needs a title.');
      return;
    }

    this.saving.set(true);
    this.sheetError.set(null);
    this.api
      .updateActionStep(this.actionId(), step.id, {
        title,
        description: this.draftBody().trim() || null,
        assigneeId: this.draftAssignee() || null,
        dueDate: this.draftDue() || null,
      })
      .subscribe({
        next: (steps) => {
          this.steps.set(steps);
          this.saving.set(false);
          this.editing.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving.set(false);
          this.sheetError.set(err.error?.message ?? 'Could not save that note.');
        },
      });
  }

  protected add(event: Event): void {
    event.preventDefault();
    const title = this.title().trim();
    if (!title) {
      return;
    }

    this.busy.set(true);
    this.api
      .addActionStep(this.actionId(), {
        title,
        dueDate: this.dueDate() || undefined,
        assigneeId: this.assigneeId() || undefined,
      })
      .subscribe({
        next: (steps) => {
          this.steps.set(steps);
          this.title.set('');
          this.dueDate.set('');
          this.assigneeId.set('');
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
  }

  protected start(step: ApiActionStep, event: Event): void {
    event.stopPropagation();
    this.error.set(null);
    this.api.startActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
      error: (err: { error?: { message?: string } }) => {
        const message = err.error?.message ?? 'Could not start that step.';
        this.error.set(message);
        this.sheetError.set(message);
      },
    });
  }

  protected complete(step: ApiActionStep, event: Event): void {
    event.stopPropagation();
    this.api.completeActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  protected reopen(step: ApiActionStep, event: Event): void {
    event.stopPropagation();
    this.api.reopenActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  protected remove(step: ApiActionStep): void {
    this.api.removeActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => {
        this.steps.set(steps);
        this.close();
      },
    });
  }

  /** Paper colour by state — the board reads at a glance before anything is. */
  protected paper(step: ApiActionStep): string {
    if (step.status === 'DONE') {
      return '#e3f1e2';
    }
    if (step.overdue) {
      return '#fae0e2';
    }
    if (step.status === 'BLOCKED') {
      return '#f7e6d5';
    }
    if (step.status === 'IN_PROGRESS') {
      return '#e2ecf9';
    }
    return '#fcf4d3';
  }

  protected dotColour(step: ApiActionStep): string {
    switch (step.status) {
      case 'DONE':
        return 'var(--color-good)';
      case 'IN_PROGRESS':
        return 'var(--color-accent-bright)';
      case 'BLOCKED':
        return 'var(--color-overdue)';
      default:
        return step.isNext ? 'var(--color-soon)' : '#b9b1a0';
    }
  }

  protected statusLabel(step: ApiActionStep): string {
    switch (step.status) {
      case 'DONE':
        return 'Done';
      case 'IN_PROGRESS':
        return step.running ? 'In progress' : 'Started, clock stopped';
      case 'BLOCKED':
        return step.blockedReason ? `Blocked — ${step.blockedReason}` : 'Blocked';
      default:
        return step.overdue ? 'Not started, past its date' : 'Not started';
    }
  }

  /** Days once it passes a working day: "3d 2h", not "1560m". */
  protected effort(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    if (minutes < 480) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
    }

    const days = Math.floor(minutes / 480);
    const hours = Math.round((minutes % 480) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * A small alternating lean, so notes read as pinned rather than printed.
   *
   * Derived from position rather than random, so a note does not jump every
   * time the list re-renders.
   */
  protected tiltFor(index: number): string {
    const lean = [-0.8, 0.6, -0.4, 0.9, -0.6, 0.3];
    return `${lean[index % lean.length]}deg`;
  }

  protected shortDate(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  }
}
