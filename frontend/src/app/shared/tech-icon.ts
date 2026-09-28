import { Component, computed, inject, input, signal } from '@angular/core';
import { Api } from '../core/api';

const TYPE_TINT: Record<string, string> = {
  DATABASE: '47A248',
  RUNTIME: '5FA04E',
  FRAMEWORK: 'DD0031',
  OS: 'EE0000',
  CONTAINER: '2496ED',
  ORCHESTRATION: '326CE5',
  MESSAGING: 'FF6600',
  LIBRARY: '8957E5',
  OTHER: '648793',
};

@Component({
  selector: 'lime-tech-icon',
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (isOwnProduct()) {
      <img
        src="/lime-mark.png"
        [attr.width]="size()"
        [attr.height]="size()"
        alt="Lime"
        [style.width.px]="size()"
        [style.height.px]="size()"
      />
    } @else if (mark(); as brand) {
      <img
        [src]="'https://cdn.simpleicons.org/' + brand.slug + '/' + brand.colour"
        [attr.width]="size()"
        [attr.height]="size()"
        [alt]="technology() + ' logo'"
        loading="lazy"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="grid place-items-center rounded-[5px] font-semibold"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.42"
        [style.background]="'#' + tint() + '22'"
        [style.color]="'#' + tint()"
        [attr.aria-label]="technology()"
      >
        {{ letters() }}
      </span>
    }
  `,
})
export class TechIcon {
  private readonly api = inject(Api);

  readonly technology = input.required<string>();
  readonly size = input(20);

  readonly iconSlug = input<string | null>(null);
  readonly iconColour = input<string | null>(null);
  readonly componentType = input<string | null>(null);

  protected readonly failed = signal(false);

  protected readonly isOwnProduct = computed(
    () => this.technology().trim().toLowerCase() === 'lime',
  );

  private readonly registered = computed(() =>
    this.api.technologies().find((t) => t.name === this.technology()),
  );

  protected readonly mark = computed(() => {
    if (this.failed()) {
      return null;
    }

    const slug = this.iconSlug() ?? this.registered()?.iconSlug;
    const colour = this.iconColour() ?? this.registered()?.iconColour;

    return slug ? { slug, colour: colour ?? '999999' } : null;
  });

  protected readonly tint = computed(() => {
    const type = this.componentType() ?? this.registered()?.componentType ?? 'OTHER';
    return TYPE_TINT[type] ?? TYPE_TINT['OTHER'];
  });

  protected readonly letters = computed(() =>
    this.technology()
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );
}
