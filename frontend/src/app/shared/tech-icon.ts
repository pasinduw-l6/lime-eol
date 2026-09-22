import { Component, computed, input, signal } from '@angular/core';

/** Technology name → Simple Icons slug and brand colour. */
const BRANDS: Record<string, { slug: string; colour: string }> = {
  mongodb: { slug: 'mongodb', colour: '47A248' },
  docker: { slug: 'docker', colour: '2496ED' },
  'docker engine': { slug: 'docker', colour: '2496ED' },
  kubernetes: { slug: 'kubernetes', colour: '326CE5' },
  rhel: { slug: 'redhat', colour: 'EE0000' },
  'red hat enterprise linux': { slug: 'redhat', colour: 'EE0000' },
  'node.js': { slug: 'nodedotjs', colour: '5FA04E' },
  nodejs: { slug: 'nodedotjs', colour: '5FA04E' },
  angular: { slug: 'angular', colour: 'DD0031' },
  'apache kafka': { slug: 'apachekafka', colour: 'FFFFFF' },
  kafka: { slug: 'apachekafka', colour: 'FFFFFF' },
  postgresql: { slug: 'postgresql', colour: '4169E1' },
  redis: { slug: 'redis', colour: 'FF4438' },
  nginx: { slug: 'nginx', colour: '009639' },
  openssl: { slug: 'openssl', colour: '721412' },
  python: { slug: 'python', colour: '3776AB' },
  java: { slug: 'openjdk', colour: 'FFFFFF' },
};

/**
 * The real logo of a technology, from Simple Icons.
 *
 * Falls back to a lettered tile when the brand is unknown or the icon fails to
 * load, so an unrecognised technology still renders something deliberate
 * rather than a broken image.
 */
@Component({
  selector: 'lime-tech-icon',
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (brand() && !failed()) {
      <img
        [src]="'https://cdn.simpleicons.org/' + brand()!.slug + '/' + brand()!.colour"
        [attr.width]="size()"
        [attr.height]="size()"
        [alt]="technology() + ' logo'"
        loading="lazy"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="grid place-items-center rounded-[5px] bg-elevated font-semibold text-ink-soft"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.45"
        [attr.aria-label]="technology()"
      >
        {{ letters() }}
      </span>
    }
  `,
})
export class TechIcon {
  readonly technology = input.required<string>();
  readonly size = input(20);

  protected readonly failed = signal(false);

  protected readonly brand = computed(
    () => BRANDS[this.technology().trim().toLowerCase()] ?? null,
  );

  protected readonly letters = computed(() =>
    this.technology()
      .split(/[\s.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );
}
