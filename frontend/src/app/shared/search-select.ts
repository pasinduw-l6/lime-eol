import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HlmInput } from '@spartan-ng/helm/input';
import { Observable, Subscription } from 'rxjs';

export interface SearchOption {
  value: string;
  label: string;
  hint?: string;
  group?: string;
}

interface Row {
  key: string;
  header?: string;
  option?: SearchOption;
  index?: number;
}

/**
 * A dropdown you can type into. Long lists filter as you type; with `remote` set, every
 * search is asked of the server instead (used for Jira people, who are never stored here).
 * The list opens in the page overlay, so a dialog or card never clips it.
 */
@Component({
  selector: 'lime-search-select',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, HlmInput],
  host: { class: 'block' },
  template: `
    <button
      type="button"
      hlmInput
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      class="flex w-full items-center justify-between gap-2 text-left"
      [style.height]="compact() ? '2rem' : null"
      [style.padding-block]="compact() ? '0' : null"
      [style.font-size]="compact() ? '13px' : null"
      [style.color]="value() ? null : 'var(--muted-foreground)'"
      [disabled]="disabled()"
      [attr.aria-label]="label() || null"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      (click)="toggle(origin.elementRef.nativeElement)"
      (keydown.arrowDown)="$event.preventDefault(); show(origin.elementRef.nativeElement)"
    >
      <span class="truncate">{{ shown() }}</span>
      <svg class="shrink-0 opacity-60" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayWidth]="width()"
      (overlayOutsideClick)="outside($event, origin.elementRef.nativeElement)"
      (attach)="focusSearch()"
      (detach)="open.set(false)"
    >
      <div class="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md" (keydown)="onKey($event, origin.elementRef.nativeElement)">
        <input
          #searchBox
          class="w-full border-b bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground"
          [value]="query()"
          (input)="onQuery($any($event.target).value)"
          [placeholder]="remote() ? 'Type a name to search…' : 'Type to filter…'"
          aria-label="Search"
          autocomplete="off"
        />
        <ul role="listbox" class="m-0 max-h-64 list-none overflow-y-auto p-1">
          @for (row of rows(); track row.key) {
            @if (row.header) {
              <li class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{{ row.header }}</li>
            } @else {
              <li
                role="option"
                class="flex cursor-pointer items-baseline justify-between gap-3 rounded px-2 py-1.5 text-[13px]"
                [class.bg-muted]="row.index === active()"
                [class.font-semibold]="row.option!.value === value()"
                [attr.aria-selected]="row.option!.value === value()"
                (mousedown)="$event.preventDefault()"
                (mouseenter)="active.set(row.index!)"
                (click)="choose(row.option!, origin.elementRef.nativeElement)"
              >
                <span class="truncate">{{ row.option!.label }}</span>
                @if (row.option!.hint) {
                  <span class="shrink-0 text-[11.5px] text-muted-foreground">{{ row.option!.hint }}</span>
                }
              </li>
            }
          } @empty {
            <li class="px-2 py-2 text-[13px] text-muted-foreground">{{ loading() ? 'Searching…' : emptyText() }}</li>
          }
        </ul>
      </div>
    </ng-template>
  `,
})
export class SearchSelect {
  readonly options = input<SearchOption[]>([]);
  readonly value = model<string>('');
  readonly placeholder = input('Choose…');
  /** When set, a first entry with an empty value, e.g. "Unassigned". */
  readonly emptyLabel = input<string | null>(null);
  readonly remote = input<((query: string) => Observable<SearchOption[]>) | null>(null);
  /** What to show for a value that is not in the list yet, such as the current Jira assignee. */
  readonly selectedLabel = input<string | null>(null);
  readonly emptyText = input('No matches');
  readonly disabled = input(false);
  readonly label = input('');
  /** The smaller 32px height used in filter bars and tables. */
  readonly compact = input(false);
  readonly picked = output<SearchOption | null>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly width = signal(240);
  protected readonly loading = signal(false);
  private readonly found = signal<SearchOption[]>([]);
  private readonly last = signal<SearchOption | null>(null);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: Subscription | undefined;

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.request?.unsubscribe();
    });
  }

  private readonly choices = computed<SearchOption[]>(() => {
    const query = this.query().trim().toLowerCase();
    const list = this.remote()
      ? this.found()
      : this.options().filter((o) => {
          const text = `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase();
          return query.split(/\s+/).every((word) => text.includes(word));
        });
    const empty = this.emptyLabel();
    return empty !== null && !query ? [{ value: '', label: empty }, ...list] : list;
  });

  protected readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    let group: string | undefined;
    this.choices().forEach((option, index) => {
      if (option.group && option.group !== group) {
        rows.push({ key: `g${index}`, header: option.group });
      }
      group = option.group;
      rows.push({ key: `o${index}`, option, index });
    });
    return rows;
  });

  protected readonly shown = computed(() => {
    const value = this.value();
    if (!value) return this.emptyLabel() ?? this.placeholder();
    const match =
      this.options().find((o) => o.value === value) ??
      this.found().find((o) => o.value === value) ??
      (this.last()?.value === value ? this.last() : null);
    return match?.label ?? this.selectedLabel() ?? value;
  });

  protected toggle(button: HTMLElement): void {
    if (this.open()) this.open.set(false);
    else this.show(button);
  }

  protected show(button: HTMLElement): void {
    if (this.disabled()) return;
    this.width.set(Math.max(240, button.getBoundingClientRect().width));
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    this.load('');
  }

  protected focusSearch(): void {
    setTimeout(() => this.searchBox()?.nativeElement.focus());
  }

  protected onQuery(text: string): void {
    this.query.set(text);
    this.active.set(0);
    this.load(text);
  }

  protected onKey(event: KeyboardEvent, button: HTMLElement): void {
    const count = this.choices().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.set(Math.min(count - 1, this.active() + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(0, this.active() - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = this.choices()[this.active()];
        if (option) this.choose(option, button);
        break;
      }
      case 'Escape':
      case 'Tab':
        this.open.set(false);
        button.focus();
        break;
    }
  }

  protected choose(option: SearchOption, button: HTMLElement): void {
    this.last.set(option);
    this.value.set(option.value);
    this.picked.emit(option.value ? option : null);
    this.open.set(false);
    button.focus();
  }

  protected outside(event: MouseEvent, button: HTMLElement): void {
    if (!button.contains(event.target as Node)) this.open.set(false);
  }

  private load(query: string): void {
    const remote = this.remote();
    if (!remote) return;
    clearTimeout(this.timer);
    this.loading.set(true);
    this.timer = setTimeout(
      () => {
        this.request?.unsubscribe();
        this.request = remote(query.trim()).subscribe({
          next: (options) => {
            this.found.set(options);
            this.loading.set(false);
          },
          error: () => {
            this.found.set([]);
            this.loading.set(false);
          },
        });
      },
      query ? 250 : 0,
    );
  }
}
