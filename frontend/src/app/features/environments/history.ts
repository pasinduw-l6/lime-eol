import { Component, computed, inject, input, signal } from '@angular/core';
import {
  ComponentChange,
  SideRow,
  collapse,
  diffLines,
  stringifyTopology,
  summariseChange,
  toSideBySide,
} from '../../core/diff';
import { RegistryStore } from '../../core/registry.store';
import { Revision } from '../../core/models';

/**
 * Revision history for one environment.
 *
 * Commits on the left, a side-by-side diff on the right, with the exact tokens
 * that changed highlighted inside the line. A version bump should read as
 * "8.2.12 became 8.3.11", not as two rewritten lines.
 */
@Component({
  selector: 'lime-history',
  host: { class: 'block' },
  template: `
    <div class="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <!-- commits -->
      <aside class="border-b border-rule pb-4 xl:border-r xl:border-b-0 xl:pr-4 xl:pb-0">
        <h3 class="m-0 mb-3 text-[13px] font-semibold">
          {{ revisions().length }} revision(s)
        </h3>
        <ol class="m-0 flex list-none flex-col gap-1 p-0">
          @for (row of revisions(); track row.revision.id) {
            <li>
              <button
                type="button"
                class="w-full rounded-lg px-3 py-2 text-left hover:bg-elevated"
                [class.bg-elevated]="selectedId() === row.revision.id"
                (click)="selectedId.set(row.revision.id)"
              >
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-[13px]">{{ row.revision.message }}</span>
                  <span class="tabular shrink-0 text-[11px]">
                    <span class="text-good">+{{ row.added }}</span>
                    <span class="text-overdue"> −{{ row.removed }}</span>
                  </span>
                </span>
                <span class="tabular mt-0.5 block text-[11px] text-ink-soft">
                  r{{ row.revision.number }} · {{ row.revision.author }} ·
                  {{ when(row.revision.createdAt) }}
                </span>
              </button>
            </li>
          }
        </ol>
      </aside>

      <!-- diff -->
      <div class="min-w-0">
        @if (selected(); as revision) {
          <header class="mb-3">
            <h3 class="m-0 text-[15px] font-semibold">{{ revision.message }}</h3>
            <p class="tabular m-0 text-[12px] text-ink-soft">
              r{{ revision.number }} · {{ revision.author }} ·
              {{ when(revision.createdAt) }}
              @if (!parent()) {
                <span> · first recorded state</span>
              }
            </p>
          </header>

          @if (changes().length > 0) {
            <ul class="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
              @for (change of changes(); track change.technology + change.node) {
                <li
                  class="rounded-full border border-rule px-3 py-1 text-[12px]"
                  [class.text-good]="change.kind === 'UPGRADE' || change.kind === 'ADDED'"
                  [class.text-soon]="change.kind === 'DOWNGRADE'"
                  [class.text-overdue]="change.kind === 'REMOVED'"
                >
                  <span class="text-ink-soft">{{ change.node }}</span>
                  {{ change.technology }}
                  <span class="tabular">
                    @if (change.from && change.to) {
                      {{ change.from }} → {{ change.to }}
                    } @else if (change.to) {
                      + {{ change.to }}
                    } @else {
                      − {{ change.from }}
                    }
                  </span>
                </li>
              }
            </ul>
          }

          <div class="overflow-x-auto rounded-xl border border-rule">
            <table class="w-full border-collapse font-mono text-[11.5px] leading-[1.55]">
              <caption class="sr-only">
                Changes in revision {{ revision.number }}
              </caption>
              <tbody>
                @for (row of rows(); track $index) {
                  @if (row === 'gap') {
                    <tr>
                      <td colspan="4" class="bg-elevated px-3 py-1 text-center text-ink-faint">⋯</td>
                    </tr>
                  } @else {
                    <tr>
                      <!-- before -->
                      <td class="w-[46px] border-r border-rule px-2 text-right align-top text-ink-faint select-none">
                        {{ row.old?.no ?? '' }}
                      </td>
                      <td
                        class="w-1/2 px-3 align-top whitespace-pre-wrap"
                        [class.diff-line-remove]="row.old?.changed"
                      >
                        @for (seg of row.old?.segments ?? []; track $index) {
                          <span [class.diff-word-remove]="seg.changed">{{ seg.text }}</span>
                        }
                      </td>
                      <!-- after -->
                      <td class="w-[46px] border-r border-l border-rule px-2 text-right align-top text-ink-faint select-none">
                        {{ row.new?.no ?? '' }}
                      </td>
                      <td
                        class="w-1/2 px-3 align-top whitespace-pre-wrap"
                        [class.diff-line-add]="row.new?.changed"
                      >
                        @for (seg of row.new?.segments ?? []; track $index) {
                          <span [class.diff-word-add]="seg.changed">{{ seg.text }}</span>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-[13px] text-ink-soft">Select a revision to see what changed.</p>
        }
      </div>
    </div>
  `,
})
export class History {
  private readonly store = inject(RegistryStore);

  readonly deploymentId = input.required<string>();

  protected readonly selectedId = signal<string | null>(null);

  protected readonly revisions = computed(() =>
    this.store.revisionsFor(this.deploymentId()).map((revision) => {
      const parent = this.store.parentOf(revision);
      const lines = diffLines(
        parent ? stringifyTopology(parent.content) : '',
        stringifyTopology(revision.content),
      );
      return {
        revision,
        added: lines.filter((l) => l.type === 'add').length,
        removed: lines.filter((l) => l.type === 'remove').length,
      };
    }),
  );

  protected readonly selected = computed<Revision | null>(() => {
    const list = this.revisions();
    const chosen = list.find((r) => r.revision.id === this.selectedId());
    return chosen?.revision ?? list[0]?.revision ?? null;
  });

  protected readonly parent = computed(() => {
    const revision = this.selected();
    return revision ? this.store.parentOf(revision) : null;
  });

  protected readonly rows = computed<(SideRow | 'gap')[]>(() => {
    const revision = this.selected();
    if (!revision) {
      return [];
    }
    const parent = this.parent();
    const lines = diffLines(
      parent ? stringifyTopology(parent.content) : '',
      stringifyTopology(revision.content),
    );
    return collapse(toSideBySide(lines));
  });

  protected readonly changes = computed<ComponentChange[]>(() => {
    const revision = this.selected();
    if (!revision) {
      return [];
    }
    return summariseChange(this.parent()?.content ?? null, revision.content);
  });

  protected when(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
