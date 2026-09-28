import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegistryStore } from '../core/registry.store';

interface Tool {
  key: string;
  label: string;
  title: string;
  /** Wrapped around the selection, or inserted at the caret. */
  before: string;
  after: string;
  /** Prefixes each selected line instead, for lists and quotes. */
  linePrefix?: string | ((index: number) => string);
}

const TOOLS: Tool[] = [
  { key: 'b', label: 'B', title: 'Bold', before: '**', after: '**' },
  { key: 'i', label: 'I', title: 'Italic', before: '*', after: '*' },
  { key: 'ul', label: '•', title: 'Bullet list', before: '', after: '', linePrefix: '- ' },
  {
    key: 'ol',
    label: '1.',
    title: 'Numbered list',
    before: '',
    after: '',
    linePrefix: (index) => `${index + 1}. `,
  },
  { key: 'link', label: '🔗', title: 'Link', before: '[', after: '](https://)' },
  { key: 'code', label: '<>', title: 'Code', before: '`', after: '`' },
  { key: 'quote', label: '❝', title: 'Quote', before: '', after: '', linePrefix: '> ' },
];

/**
 * The long note on a step.
 *
 * Markdown rather than rich text: the content is short operational notes, and
 * storing HTML would mean sanitising every path it is rendered on. Markdown
 * stays readable even with nothing to render it.
 *
 * The field grows with what is written — a note box that stays four lines tall
 * while someone writes twenty is the thing that stops them writing them.
 */
@Component({
  selector: 'lime-note-editor',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="overflow-hidden rounded-[var(--radius-control)] border border-rule">
      <div class="flex flex-wrap items-center gap-0.5 border-b border-rule px-1.5 py-1">
        @for (tool of tools; track tool.key) {
          <button
            type="button"
            class="grid h-7 min-w-[28px] place-items-center rounded-md px-1.5 text-[12px] text-ink-soft hover:bg-elevated hover:text-ink"
            [class.font-bold]="tool.key === 'b'"
            [class.italic]="tool.key === 'i'"
            [attr.title]="tool.title"
            [attr.aria-label]="tool.title"
            (click)="apply(tool)"
          >
            {{ tool.label }}
          </button>
        }

        <span class="mx-1 h-4 w-px" style="background: var(--color-rule)"></span>

        <button
          type="button"
          class="grid h-7 min-w-[28px] place-items-center rounded-md px-1.5 text-[12px] text-ink-soft hover:bg-elevated hover:text-ink"
          title="Mention someone"
          aria-label="Mention someone"
          (click)="mentioning.set(!mentioning())"
        >
          &#64;
        </button>

        <span class="ml-auto pr-1 text-[10.5px] text-ink-faint">markdown</span>
      </div>

      @if (mentioning()) {
        <div class="flex flex-wrap gap-1.5 border-b border-rule px-2 py-1.5">
          @for (person of people(); track person.id) {
            <button
              type="button"
              class="glass rounded-full border border-rule px-2.5 py-0.5 text-[11.5px]"
              (click)="mention(person.name)"
            >
              {{ person.name }}
            </button>
          } @empty {
            <span class="text-[11.5px] text-ink-faint">No accounts to mention.</span>
          }
        </div>
      }

      <textarea
        #field
        class="field block w-full resize-none border-0 bg-transparent px-3 py-2.5 text-ink outline-none"
        [class.on-paper]="note()"
        [style.min-height.px]="minHeight()"
        [placeholder]="placeholder()"
        [(ngModel)]="value"
        (input)="grow()"
        name="notebody"
      ></textarea>
    </div>
  `,
  styles: `
    .field {
      font: inherit;
      font-size: 13.5px;
      line-height: 1.5;
    }

    /* On paper the note takes the note face, and the colour is inherited so
       the host decides what ink this is. */
    .field.on-paper {
      font-family: var(--font-note);
      font-size: 13.5px;
      line-height: 1.65;
      letter-spacing: -0.1px;
      color: inherit;
    }

    /* The prompt is the application talking, not the note. */
    .field.on-paper::placeholder {
      font-family: var(--font-sans);
      font-size: 12.5px;
      letter-spacing: normal;
    }
  `,
})
export class NoteEditor {
  private readonly store = inject(RegistryStore);

  readonly value = model<string>('');
  readonly placeholder = input('');
  readonly minHeight = input(96);

  /** How far it may grow before it scrolls instead. */
  readonly maxHeight = input(420);

  /** The note face, for an editor sitting on paper rather than on glass. */
  readonly note = input(false);

  protected readonly tools = TOOLS;
  protected readonly mentioning = signal(false);
  protected readonly people = computed(() => this.store.engineers());

  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  constructor() {
    // Also grows when the value arrives from outside, such as opening a note
    // that already has a long body.
    effect(() => {
      this.value();
      queueMicrotask(() => this.grow());
    });
  }

  protected grow(): void {
    const element = this.field()?.nativeElement;
    if (!element) {
      return;
    }

    // Reset first: without it the box can only ever get taller, never shorter.
    element.style.height = 'auto';
    const wanted = Math.min(element.scrollHeight, this.maxHeight());
    element.style.height = `${Math.max(wanted, this.minHeight())}px`;
    element.style.overflowY = element.scrollHeight > this.maxHeight() ? 'auto' : 'hidden';
  }

  protected mention(name: string): void {
    this.insert(`@${name} `, '');
    this.mentioning.set(false);
  }

  protected apply(tool: Tool): void {
    if (tool.linePrefix) {
      this.prefixLines(tool.linePrefix);
      return;
    }
    this.insert(tool.before, tool.after);
  }

  /** Wraps the selection, or drops a marker where the caret is. */
  private insert(before: string, after: string): void {
    const element = this.field()?.nativeElement;
    if (!element) {
      return;
    }

    const { selectionStart: start, selectionEnd: end } = element;
    const text = this.value();
    const selected = text.slice(start, end);

    this.value.set(text.slice(0, start) + before + selected + after + text.slice(end));

    queueMicrotask(() => {
      element.focus();
      // Empty selection leaves the caret between the markers, ready to type.
      const caret = start + before.length + selected.length;
      element.setSelectionRange(caret, caret);
      this.grow();
    });
  }

  private prefixLines(prefix: string | ((index: number) => string)): void {
    const element = this.field()?.nativeElement;
    if (!element) {
      return;
    }

    const text = this.value();
    const start = text.lastIndexOf('\n', element.selectionStart - 1) + 1;
    const lineEnd = text.indexOf('\n', element.selectionEnd);
    const end = lineEnd === -1 ? text.length : lineEnd;

    const prefixed = text
      .slice(start, end)
      .split('\n')
      .map((line, index) =>
        typeof prefix === 'string' ? prefix + line : prefix(index) + line,
      )
      .join('\n');

    this.value.set(text.slice(0, start) + prefixed + text.slice(end));

    queueMicrotask(() => {
      element.focus();
      element.setSelectionRange(start + prefixed.length, start + prefixed.length);
      this.grow();
    });
  }
}
