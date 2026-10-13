import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { TechIcon } from './tech-icon';

export type GanttZoom = 'week' | 'month' | 'quarter';

export interface GanttItem {
  id: string;
  name: string;
  technology: string;
  statusLabel: string;
  colour: string;
  people: string[];
  start: string;
  end: string;
  due: string | null;
  overdue: boolean;
  progress: number;
  eol: string | null;
  riskExpiry: string | null;
  jiraKey: string | null;
  jiraUrl: string | null;
  jiraError: string | null;
  subs: GanttSub[];
  terms: { label: string; long: string; colour: string } | null;
}

export interface GanttSub {
  key: string;
  summary: string;
  status: string;
  colour: string;
  assignee: string | null;
  start: string | null;
  end: string | null;
  estimate: number | null;
  spent: number | null;
  progress: number;
  url: string;
}

export interface GanttSubEvent {
  planId: string;
  key: string;
  action: 'edit' | 'status' | 'log' | 'open';
}

export interface GanttSubReschedule {
  planId: string;
  key: string;
  start: string;
  end: string;
}

export interface GanttJiraEvent {
  planId: string;
  action: 'create' | 'link' | 'add';
}

export interface GanttGroup {
  id: string;
  title: string;
  subtitle: string;
  items: GanttItem[];
}

export interface GanttReschedule {
  id: string;
  start: string;
  end: string;
}

export interface GanttMenu {
  id: string;
  action: 'open' | 'edit' | 'complete' | 'delete';
}

type DragMode = 'move' | 'start' | 'end';

interface DragTarget {
  id: string;
  start: string;
  end: string;
  eol: string | null;
  progress: number;
  planId: string;
  key: string | null;
}

interface Segment {
  key: string;
  label: string;
  left: number;
  width: number;
  weekend?: boolean;
  today?: boolean;
}

const DAY = 86_400_000;
const SCALE: Record<GanttZoom, { min: number; span: number; lead: number }> = {
  week: { min: 44, span: 14, lead: 2 },
  month: { min: 18, span: 42, lead: 7 },
  quarter: { min: 7, span: 98, lead: 14 },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROW = 40;

@Component({
  selector: 'lime-gantt',
  imports: [HlmBadgeImports, TechIcon],
  host: {
    class: 'block',
    '(document:pointerdown)': 'menuFor.set(null)',
    '(document:keydown.escape)': 'menuFor.set(null)',
  },
  template: `
    <div class="relative overflow-hidden rounded-xl border bg-card">
      <div
        #scroller
        class="scroll-hidden relative h-[calc(100vh-262px)] min-h-[360px] overflow-auto"
        [class.select-none]="drag() !== null"
      >
        <div class="relative flex min-h-full flex-col" [style.width.px]="left() + width()">
          <div class="sticky top-0 z-30 flex border-b bg-card" [style.height.px]="64">
            <div
              class="sticky left-0 z-40 flex shrink-0 items-end border-r bg-card pb-2 text-[12px] font-medium text-muted-foreground"
              [style.width.px]="left()"
            >
              <span class="relative flex-1 pl-11">
                Name
                <span
                  class="absolute -top-[30px] right-0 bottom-[-8px] w-1.5 cursor-col-resize hover:bg-primary/40"
                  title="Drag to resize"
                  (pointerdown)="startResize($event)"
                ></span>
              </span>
              <span class="w-[118px] max-md:hidden">Status</span>
              <span class="w-[78px] max-md:hidden">Owner</span>
              <span class="w-[70px] pr-3">Due</span>
            </div>

            <div class="relative shrink-0 overflow-hidden" [style.width.px]="width()">
              @for (s of top(); track s.key) {
                <div
                  class="absolute top-0 flex h-8 items-center truncate border-l px-2 text-[12px] font-medium text-muted-foreground"
                  [style.left.px]="s.left"
                  [style.width.px]="s.width"
                >
                  {{ s.label }}
                </div>
              }
              @for (s of bottom(); track s.key) {
                <div
                  class="absolute top-8 flex h-8 items-center justify-center truncate border-t border-l text-[11.5px]"
                  [style.left.px]="s.left"
                  [style.width.px]="s.width"
                  [style.color]="s.today ? 'var(--primary)' : null"
                  [class.font-semibold]="s.today"
                  [class.text-muted-foreground]="!s.today"
                >
                  {{ s.label }}
                </div>
              }
            </div>
          </div>

          <div class="relative flex flex-1 flex-col">
            <div
              class="pointer-events-none absolute top-0 bottom-0"
              [style.left.px]="left()"
              [style.width.px]="width()"
              [style.background-image]="gridBackground()"
            >
              @if (todayAt() !== null) {
                <div
                  class="absolute top-0 bottom-0 z-10 w-px"
                  style="background: var(--primary)"
                  [style.left.px]="todayAt()"
                >
                  <span class="absolute -top-px -left-[3px] size-[7px] rounded-full" style="background: var(--primary)"></span>
                </div>
              }
            </div>

            @for (group of groups(); track group.id) {
              @let closed = collapsed().has(group.id);
              @let summary = groupSpan(group);
              <div class="relative flex border-b" [style.height.px]="row">
                <div
                  class="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card pr-2 pl-3"
                  [style.width.px]="left()"
                >
                  <button
                    type="button"
                    class="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                    [attr.aria-expanded]="!closed"
                    [attr.aria-label]="(closed ? 'Expand ' : 'Collapse ') + group.title"
                    (click)="toggle(group.id)"
                  >
                    <svg viewBox="0 0 16 16" class="size-3.5 transition-transform" [style.transform]="closed ? 'rotate(-90deg)' : null">
                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <span class="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {{ group.title }}
                    <span class="font-normal text-muted-foreground">· {{ group.subtitle }}</span>
                  </span>
                  <span class="flex items-center gap-1.5 text-[11.5px] text-muted-foreground tabular" [title]="doneCount(group) + ' of ' + group.items.length + ' done'">
                    <svg viewBox="0 0 20 20" class="size-4 -rotate-90">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="var(--border)" stroke-width="3" />
                      <circle
                        cx="10" cy="10" r="7" fill="none" stroke="var(--color-good)" stroke-width="3"
                        [attr.stroke-dasharray]="44"
                        [attr.stroke-dashoffset]="44 - 44 * (doneCount(group) / (group.items.length || 1))"
                      />
                    </svg>
                    {{ doneCount(group) }}/{{ group.items.length }}
                  </span>
                </div>
                <div class="relative shrink-0 overflow-hidden" [style.width.px]="width()">
                  @if (summary) {
                    <div
                      class="absolute top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full"
                      style="background: color-mix(in oklab, var(--muted-foreground) 30%, transparent)"
                      [style.left.px]="summary.left"
                      [style.width.px]="summary.width"
                    >
                      <div class="h-full rounded-full" style="background: var(--muted-foreground)" [style.width.%]="summary.progress * 100"></div>
                    </div>
                  }
                </div>
              </div>

              @if (!closed) {
                @for (item of group.items; track item.id) {
                  @let bar = barFor(item);
                  <div class="group/row relative flex border-b hover:bg-muted/40" [style.height.px]="row">
                    <div
                      class="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card text-[13px] group-hover/row:bg-muted"
                      [style.width.px]="left()"
                    >
                      <button
                        type="button"
                        class="ml-[26px] grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background"
                        [attr.aria-expanded]="isOpen(group.id, item)"
                        [attr.aria-label]="(isOpen(group.id, item) ? 'Hide' : 'Show') + ' sub-tasks of ' + item.name"
                        [title]="item.subs.length ? item.subs.length + ' sub-task(s) in Jira' : item.jiraKey ? 'No sub-tasks yet' : 'Not linked to Jira'"
                        (click)="toggleItem(group.id, item)"
                      >
                        <svg viewBox="0 0 16 16" class="size-3 transition-transform" [style.transform]="isOpen(group.id, item) ? null : 'rotate(-90deg)'">
                          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-2 pr-3 pl-1 text-left hover:underline"
                        (click)="menu.emit({ id: item.id, action: 'open' })"
                      >
                        <span class="size-2 shrink-0 rounded-full" [style.background]="item.colour"></span>
                        <lime-tech-icon [technology]="item.technology" [size]="16" />
                        <span class="truncate">{{ item.name }}</span>
                        @if (item.jiraKey) {
                          <span class="shrink-0 rounded border px-1 text-[10.5px] text-muted-foreground tabular">{{ item.jiraKey }}</span>
                        }
                        @if (item.terms; as t) {
                          <span
                            class="shrink-0 rounded-full border px-1.5 text-[10.5px]"
                            [title]="t.long"
                            [style.color]="t.colour"
                            [style.border-color]="tint(t.colour, 40)"
                          >{{ t.label }}</span>
                        }
                      </button>
                      <span class="w-[118px] max-md:hidden">
                        <span
                          hlmBadge
                          class="border"
                          [style.color]="item.colour"
                          [style.background]="tint(item.colour, 14)"
                          [style.border-color]="tint(item.colour, 35)"
                        >
                          {{ item.statusLabel }}
                        </span>
                      </span>
                      <span class="flex w-[78px] max-md:hidden">
                        @for (person of item.people.slice(0, 3); track person) {
                          <span
                            class="-ml-1.5 grid size-6 place-items-center rounded-full border-2 border-card text-[10px] font-semibold text-white first:ml-0"
                            [style.background]="avatarColour(person)"
                            [title]="person"
                          >{{ initials(person) }}</span>
                        } @empty {
                          <span class="size-6 rounded-full border border-dashed border-muted-foreground/50" title="Unassigned"></span>
                        }
                      </span>
                      <span
                        class="w-[46px] text-[12px] tabular"
                        [style.color]="item.overdue ? 'var(--color-overdue)' : null"
                        [class.text-muted-foreground]="!item.overdue"
                      >{{ short(item.due) }}</span>
                      <span class="relative w-6">
                        <button
                          type="button"
                          class="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background"
                          [attr.aria-label]="'Actions for ' + item.name"
                          (pointerdown)="$event.stopPropagation()"
                          (click)="menuFor.set(menuFor() === group.id + item.id ? null : group.id + item.id)"
                        >⋯</button>
                        @if (menuFor() === group.id + item.id) {
                          <div
                            class="absolute top-7 right-0 z-50 grid w-40 gap-0.5 rounded-lg border bg-popover p-1 text-[13px] shadow-lg"
                            (pointerdown)="$event.stopPropagation()"
                          >
                            <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="choose(item.id, 'open')">Open details</button>
                            @if (editable()) {
                              <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="choose(item.id, 'edit')">Edit plan</button>
                              @if (item.progress < 1) {
                                <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="choose(item.id, 'complete')">Mark completed</button>
                              }
                              <button type="button" class="rounded-md px-2 py-1.5 text-left text-destructive hover:bg-muted" (click)="choose(item.id, 'delete')">Delete</button>
                            }
                          </div>
                        }
                      </span>
                    </div>

                    <div class="relative shrink-0 overflow-hidden" [style.width.px]="width()">
                      @if (item.eol; as eol) {
                        @if (at(eol); as x) {
                          <span
                            class="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
                            style="background: var(--color-overdue)"
                            [style.left.px]="x"
                            [title]="'End of life ' + long(eol)"
                          ></span>
                        }
                      }
                      @if (item.riskExpiry; as risk) {
                        @if (at(risk); as x) {
                          <span
                            class="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
                            style="background: var(--color-soon)"
                            [style.left.px]="x"
                            [title]="'Risk acceptance expires ' + long(risk)"
                          ></span>
                        }
                      }
                      @if (bar) {
                        <div
                          class="absolute top-1/2 flex h-6 -translate-y-1/2 items-center"
                          [style.left.px]="bar.left"
                        >
                          <div
                            class="relative h-full overflow-hidden rounded-md"
                            [class.cursor-grab]="editable()"
                            [class.cursor-grabbing]="drag()?.id === item.id"
                            [style.width.px]="bar.width"
                            [style.background]="tint(item.colour, 38)"
                            [style.box-shadow]="bar.late ? '0 0 0 1.5px var(--color-overdue)' : null"
                            [title]="item.name + ': ' + long(bar.start) + ' to ' + long(bar.end) + (bar.late ? ' (finishes after end of life)' : '')"
                            (pointerdown)="startDrag($event, planTarget(item), 'move')"
                          >
                            <div class="h-full" [style.width.%]="item.progress * 100" [style.background]="item.colour"></div>
                            @if (editable()) {
                              <span class="absolute inset-y-0 left-0 w-2 cursor-ew-resize" (pointerdown)="startDrag($event, planTarget(item), 'start')"></span>
                              <span class="absolute inset-y-0 right-0 w-2 cursor-ew-resize" (pointerdown)="startDrag($event, planTarget(item), 'end')"></span>
                            }
                          </div>
                          <span class="ml-2 whitespace-nowrap text-[12.5px] font-medium">{{ item.name }}</span>
                        </div>
                      }
                    </div>
                  </div>

                  @if (isOpen(group.id, item)) {
                    @for (sub of item.subs; track sub.key) {
                      @let target = subTarget(item, sub);
                      @let subBar = target ? barFor(target) : null;
                      <div class="group/sub relative flex border-b border-dashed hover:bg-muted/40" [style.height.px]="subRow">
                        <div
                          class="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card text-[12.5px] group-hover/sub:bg-muted"
                          [style.width.px]="left()"
                        >
                          <span class="ml-[62px] mr-2 h-full w-px bg-border"></span>
                          <button
                            type="button"
                            class="flex min-w-0 flex-1 items-center gap-2 pr-2 text-left"
                            (click)="subMenu.emit({ planId: item.id, key: sub.key, action: 'edit' })"
                          >
                            <span class="size-1.5 shrink-0 rounded-full" [style.background]="sub.colour"></span>
                            <a
                              class="shrink-0 text-[11.5px] font-medium tabular hover:underline"
                              style="color: var(--primary)"
                              [href]="sub.url"
                              target="_blank"
                              rel="noopener"
                              (click)="$event.stopPropagation()"
                            >{{ sub.key }}</a>
                            <span class="truncate" [title]="sub.summary + (sub.estimate || sub.spent ? ' · logged ' + hours(sub.spent) + ' of ' + hours(sub.estimate) : '')">{{ sub.summary }}</span>
                          </button>
                          <span class="w-[118px] max-md:hidden">
                            <span
                              hlmBadge
                              class="border text-[11px]"
                              [style.color]="sub.colour"
                              [style.background]="tint(sub.colour, 12)"
                              [style.border-color]="tint(sub.colour, 30)"
                            >{{ sub.status }}</span>
                          </span>
                          <span class="flex w-[78px] max-md:hidden">
                            @if (sub.assignee; as person) {
                              <span
                                class="grid size-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                                [style.background]="avatarColour(person)"
                                [title]="person"
                              >{{ initials(person) }}</span>
                            } @else {
                              <span class="size-5 rounded-full border border-dashed border-muted-foreground/50" title="Unassigned"></span>
                            }
                          </span>
                          <span class="w-[46px] text-[11.5px] text-muted-foreground tabular">{{ short(sub.end) }}</span>
                          <span class="relative w-6">
                            <button
                              type="button"
                              class="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background"
                              [attr.aria-label]="'Actions for ' + sub.key"
                              (pointerdown)="$event.stopPropagation()"
                              (click)="menuFor.set(menuFor() === 'sub' + sub.key ? null : 'sub' + sub.key)"
                            >⋯</button>
                            @if (menuFor() === 'sub' + sub.key) {
                              <div
                                class="absolute top-7 right-0 z-50 grid w-40 gap-0.5 rounded-lg border bg-popover p-1 text-[13px] shadow-lg"
                                (pointerdown)="$event.stopPropagation()"
                              >
                                @if (editable()) {
                                  <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="chooseSub(item.id, sub.key, 'log')">Log time</button>
                                  <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="chooseSub(item.id, sub.key, 'status')">Change status</button>
                                  <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="chooseSub(item.id, sub.key, 'edit')">Edit sub-task</button>
                                }
                                <button type="button" class="rounded-md px-2 py-1.5 text-left hover:bg-muted" (click)="chooseSub(item.id, sub.key, 'open')">Open in Jira</button>
                              </div>
                            }
                          </span>
                        </div>

                        <div class="relative shrink-0 overflow-hidden" [style.width.px]="width()">
                          @if (subBar && target) {
                            <div class="absolute top-1/2 flex h-4 -translate-y-1/2 items-center" [style.left.px]="subBar.left">
                              <div
                                class="relative h-full overflow-hidden rounded"
                                [class.cursor-grab]="editable()"
                                [style.width.px]="subBar.width"
                                [style.background]="tint(sub.colour, 30)"
                                [title]="sub.key + ' ' + sub.summary + ': ' + long(subBar.start) + ' to ' + long(subBar.end)"
                                (pointerdown)="startDrag($event, target, 'move')"
                              >
                                <div class="h-full" [style.width.%]="sub.progress * 100" [style.background]="sub.colour"></div>
                                @if (editable()) {
                                  <span class="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" (pointerdown)="startDrag($event, target, 'start')"></span>
                                  <span class="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" (pointerdown)="startDrag($event, target, 'end')"></span>
                                }
                              </div>
                              <span class="ml-1.5 whitespace-nowrap text-[11.5px] text-muted-foreground">
                                {{ sub.key }}
                                @if (sub.estimate || sub.spent) {
                                  · {{ hours(sub.spent) }} / {{ hours(sub.estimate) }}
                                }
                              </span>
                            </div>
                          } @else {
                            <span class="absolute top-1/2 left-3 -translate-y-1/2 text-[11.5px] text-muted-foreground">No dates in Jira</span>
                          }
                        </div>
                      </div>
                    }

                    <div class="relative flex border-b border-dashed" [style.height.px]="subRow">
                      <div
                        class="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card text-[12.5px]"
                        [style.width.px]="left()"
                      >
                        <span class="ml-[62px] h-full w-px bg-border"></span>
                        @if (!item.jiraKey) {
                          @if (editable()) {
                            <button type="button" class="rounded-md px-1.5 py-0.5 font-medium hover:bg-muted" style="color: var(--primary)" (click)="jira.emit({ planId: item.id, action: 'add' })">+ Add sub-task</button>
                            <span class="text-muted-foreground">or</span>
                            <button type="button" class="rounded-md px-1.5 py-0.5 font-medium hover:bg-muted" style="color: var(--primary)" (click)="jira.emit({ planId: item.id, action: 'link' })">link an existing Jira issue</button>
                          } @else {
                            <span class="text-muted-foreground">No sub-tasks yet</span>
                          }
                        } @else {
                          @if (editable()) {
                            <button type="button" class="rounded-md px-1.5 py-0.5 font-medium hover:bg-muted" style="color: var(--primary)" (click)="jira.emit({ planId: item.id, action: 'add' })">+ Add sub-task</button>
                          }
                          @if (item.jiraError) {
                            <span class="truncate" style="color: var(--color-overdue)" [title]="item.jiraError">Sync failed: {{ item.jiraError }}</span>
                          } @else if (item.subs.length === 0) {
                            <span class="text-muted-foreground">No sub-tasks in {{ item.jiraKey }} yet</span>
                          }
                        }
                      </div>
                      <div class="shrink-0" [style.width.px]="width()"></div>
                    </div>
                  }
                }
              }
            }

            <div class="flex flex-1">
              <div class="sticky left-0 z-20 shrink-0 border-r bg-card" [style.width.px]="left()"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="absolute right-3 bottom-3 z-40 grid overflow-hidden rounded-lg border bg-card shadow-sm">
        <button type="button" class="grid size-7 place-items-center text-[15px] hover:bg-muted" aria-label="Zoom in" [disabled]="zoom() === 'week'" (click)="zoomBy(-1)">+</button>
        <button type="button" class="grid size-7 place-items-center border-t text-[15px] hover:bg-muted" aria-label="Zoom out" [disabled]="zoom() === 'quarter'" (click)="zoomBy(1)">−</button>
      </div>
    </div>
  `,
})
export class Gantt {
  readonly groups = input.required<GanttGroup[]>();
  readonly zoom = input<GanttZoom>('month');
  readonly anchor = input.required<string>();
  readonly editable = input(false);

  readonly reschedule = output<GanttReschedule>();
  readonly menu = output<GanttMenu>();
  readonly zoomChange = output<GanttZoom>();
  readonly subMenu = output<GanttSubEvent>();
  readonly subReschedule = output<GanttSubReschedule>();
  readonly jira = output<GanttJiraEvent>();

  protected readonly row = ROW;
  protected readonly subRow = 34;
  protected readonly toggled = signal(new Set<string>());
  protected readonly nameWidth = signal(300);
  protected readonly collapsed = signal(new Set<string>());
  protected readonly menuFor = signal<string | null>(null);
  protected readonly drag = signal<{ id: string; mode: DragMode; delta: number } | null>(null);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly left = computed(() => this.nameWidth() + (wide() ? 266 : 70));
  private readonly available = signal(0);
  protected readonly day = computed(() => {
    const { min, span } = SCALE[this.zoom()];
    return Math.max(min, Math.floor(((this.available() - this.left()) * 100) / span) / 100);
  });

  constructor() {
    const observer = new ResizeObserver(([entry]) => this.available.set(entry!.contentRect.width));
    effect((cleanup) => {
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      observer.observe(el);
      cleanup(() => observer.unobserve(el));
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected readonly origin = computed(() => {
    const anchor = parse(this.anchor());
    const start = anchor - SCALE[this.zoom()].lead * DAY;
    const weekday = (new Date(start).getUTCDay() + 6) % 7;
    return start - weekday * DAY;
  });

  protected readonly days = computed(() => SCALE[this.zoom()].span);
  protected readonly width = computed(() => this.days() * this.day());

  protected readonly todayAt = computed(() => this.at(todayIso()));

  protected readonly gridBackground = computed(() => {
    const d = this.day();
    const weekend = 'color-mix(in oklab, var(--muted-foreground) 9%, transparent)';
    const line = 'var(--border)';
    const shade = `repeating-linear-gradient(90deg, transparent 0 ${d * 5}px, ${weekend} ${d * 5}px ${d * 7}px)`;
    const lines =
      this.zoom() === 'quarter'
        ? `repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px ${d * 7}px)`
        : `repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px ${d}px)`;
    return `${lines}, ${shade}`;
  });

  protected readonly top = computed<Segment[]>(() => {
    const origin = this.origin();
    const d = this.day();
    const out: Segment[] = [];

    if (this.zoom() === 'quarter') {
      let cursor = origin;
      const end = origin + this.days() * DAY;
      while (cursor < end) {
        const date = new Date(cursor);
        const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
        const stop = Math.min(next, end);
        out.push({
          key: `m${cursor}`,
          label: `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
          left: ((cursor - origin) / DAY) * d,
          width: ((stop - cursor) / DAY) * d,
        });
        cursor = stop;
      }
      return out;
    }

    for (let i = 0; i < this.days(); i += 7) {
      const from = new Date(origin + i * DAY);
      const to = new Date(origin + (i + 6) * DAY);
      const label =
        from.getUTCMonth() === to.getUTCMonth()
          ? `W${isoWeek(from)} ${MONTHS[from.getUTCMonth()]} ${from.getUTCDate()} – ${to.getUTCDate()}`
          : `W${isoWeek(from)} ${MONTHS[from.getUTCMonth()]} ${from.getUTCDate()} – ${MONTHS[to.getUTCMonth()]} ${to.getUTCDate()}`;
      out.push({ key: `w${i}`, label, left: i * d, width: 7 * d });
    }
    return out;
  });

  protected readonly bottom = computed<Segment[]>(() => {
    const origin = this.origin();
    const d = this.day();
    const today = todayIso();
    const out: Segment[] = [];

    if (this.zoom() === 'quarter') {
      for (let i = 0; i < this.days(); i += 7) {
        const date = new Date(origin + i * DAY);
        out.push({ key: `w${i}`, label: `W${isoWeek(date)}`, left: i * d, width: 7 * d });
      }
      return out;
    }

    for (let i = 0; i < this.days(); i++) {
      const date = new Date(origin + i * DAY);
      const iso = date.toISOString().slice(0, 10);
      const name = WEEKDAYS[date.getUTCDay()];
      out.push({
        key: `d${i}`,
        label: this.zoom() === 'week' ? `${name} ${date.getUTCDate()}` : `${date.getUTCDate()}`,
        left: i * d,
        width: d,
        weekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
        today: iso === today,
      });
    }
    return out;
  });

  protected at(iso: string): number | null {
    const x = ((parse(iso) - this.origin()) / DAY) * this.day();
    return x < 0 || x > this.width() ? null : x;
  }

  protected barFor(item: { id: string; start: string; end: string; eol: string | null; progress: number }) {
    const drag = this.drag();
    let start = parse(item.start);
    let end = parse(item.end);

    if (drag && drag.id === item.id) {
      const shift = drag.delta * DAY;
      if (drag.mode !== 'end') start = Math.min(start + shift, drag.mode === 'start' ? end : Infinity);
      if (drag.mode !== 'start') end = Math.max(end + shift, drag.mode === 'end' ? start : -Infinity);
    }

    const origin = this.origin();
    const d = this.day();
    const from = ((start - origin) / DAY) * d;
    const to = ((end - origin) / DAY + 1) * d;
    if (to < 0 || from > this.width()) return null;

    return {
      left: from,
      width: Math.max(to - from, d / 2),
      start: iso(start),
      end: iso(end),
      late: !!item.eol && item.progress < 1 && end > parse(item.eol),
    };
  }

  protected groupSpan(group: GanttGroup) {
    if (group.items.length === 0) return null;
    const starts = group.items.map((i) => parse(i.start));
    const ends = group.items.map((i) => parse(i.end));
    const origin = this.origin();
    const d = this.day();
    const from = ((Math.min(...starts) - origin) / DAY) * d;
    const to = ((Math.max(...ends) - origin) / DAY + 1) * d;
    if (to < 0 || from > this.width()) return null;
    const progress = group.items.reduce((sum, i) => sum + i.progress, 0) / group.items.length;
    return { left: from, width: to - from, progress };
  }

  protected doneCount(group: GanttGroup): number {
    return group.items.filter((i) => i.progress >= 1).length;
  }

  protected toggle(id: string): void {
    const next = new Set(this.collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.collapsed.set(next);
  }

  protected choose(id: string, action: GanttMenu['action']): void {
    this.menuFor.set(null);
    this.menu.emit({ id, action });
  }

  protected zoomBy(step: number): void {
    const order: GanttZoom[] = ['week', 'month', 'quarter'];
    const next = order[order.indexOf(this.zoom()) + step];
    if (next) this.zoomChange.emit(next);
  }

  scrollToToday(): void {
    const el = this.scroller()?.nativeElement;
    const x = this.todayAt();
    if (el && x !== null) {
      el.scrollTo({ left: Math.max(0, x - (el.clientWidth - this.left()) / 3), behavior: 'smooth' });
    }
  }

  protected planTarget(item: GanttItem): DragTarget {
    return { id: item.id, start: item.start, end: item.end, eol: item.eol, progress: item.progress, planId: item.id, key: null };
  }

  protected subTarget(item: GanttItem, sub: GanttSub): DragTarget | null {
    const start = sub.start ?? sub.end;
    const end = sub.end ?? sub.start;
    if (!start || !end) return null;
    return {
      id: `sub:${item.id}:${sub.key}`,
      start: start <= end ? start : end,
      end,
      eol: null,
      progress: sub.progress,
      planId: item.id,
      key: sub.key,
    };
  }

  protected isOpen(groupId: string, item: GanttItem): boolean {
    const fallback = item.subs.length > 0;
    return this.toggled().has(groupId + item.id) ? !fallback : fallback;
  }

  protected toggleItem(groupId: string, item: GanttItem): void {
    const next = new Set(this.toggled());
    const key = groupId + item.id;
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.toggled.set(next);
  }

  protected chooseSub(planId: string, key: string, action: GanttSubEvent['action']): void {
    this.menuFor.set(null);
    this.subMenu.emit({ planId, key, action });
  }

  protected hours(seconds: number | null): string {
    if (!seconds) return '0h';
    const minutes = Math.round(seconds / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
  }

  protected startDrag(event: PointerEvent, target: DragTarget, mode: DragMode): void {
    if (event.button !== 0) return;
    const click = () =>
      target.key
        ? this.subMenu.emit({ planId: target.planId, key: target.key, action: 'edit' })
        : this.menu.emit({ id: target.planId, action: 'open' });

    if (!this.editable()) {
      if (mode === 'move') click();
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    const origin = event.clientX;
    const d = this.day();
    let moved = false;
    this.drag.set({ id: target.id, mode, delta: 0 });

    const move = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - origin) / d);
      if (delta !== 0) moved = true;
      this.drag.set({ id: target.id, mode, delta });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const final = this.drag();
      const bar = this.barFor(target);
      this.drag.set(null);

      if (!moved || !final || final.delta === 0) {
        if (mode === 'move') click();
        return;
      }
      if (!bar) return;
      if (target.key) {
        this.subReschedule.emit({ planId: target.planId, key: target.key, start: bar.start, end: bar.end });
      } else {
        this.reschedule.emit({ id: target.planId, start: bar.start, end: bar.end });
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  protected startResize(event: PointerEvent): void {
    event.preventDefault();
    const origin = event.clientX;
    const width = this.nameWidth();
    const move = (e: PointerEvent) =>
      this.nameWidth.set(Math.min(520, Math.max(160, width + e.clientX - origin)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  protected tint(colour: string, percent: number): string {
    return `color-mix(in oklab, ${colour} ${percent}%, transparent)`;
  }

  protected initials(name: string): string {
    return name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  protected avatarColour(name: string): string {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
    return `oklch(0.55 0.12 ${Math.abs(hash) % 360})`;
  }

  protected short(value: string | null): string {
    if (!value) return '—';
    const date = new Date(parse(value));
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  }

  protected long(value: string): string {
    const date = new Date(parse(value));
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
}

function parse(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function todayIso(): string {
  const now = new Date();
  return iso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7);
}

function wide(): boolean {
  return typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches;
}

export function shiftDays(value: string, days: number): string {
  return iso(parse(value) + days * DAY);
}

export { todayIso };
