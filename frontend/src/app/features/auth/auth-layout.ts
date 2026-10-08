import { Component, input } from '@angular/core';
import { TechMarquee } from './tech-marquee';

@Component({
  selector: 'lime-auth-layout',
  imports: [TechMarquee],
  host: { class: 'block' },
  template: `
    <div class="grid min-h-svh bg-background lg:grid-cols-2">
      <main class="flex flex-col gap-4 p-6 md:p-10">
        <span class="brand-plate w-fit">
          <img src="/nav-logo.png" alt="Lime" class="h-6 w-auto" />
        </span>

        <div class="flex flex-1 items-center justify-center">
          <div class="animate-in fade-in-0 slide-in-from-bottom-2 w-full max-w-sm duration-300">
            <div class="mb-6 flex flex-col gap-1.5 text-center">
              <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ heading() }}</h1>
              <p class="m-0 text-sm text-balance text-muted-foreground">{{ subheading() }}</p>
            </div>

            <ng-content />
          </div>
        </div>
      </main>

      <aside class="relative hidden flex-col overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <span
          class="pointer-events-none absolute -top-32 -right-32 h-[460px] w-[460px] rounded-full opacity-40 blur-3xl"
          style="background: var(--primary)"
          aria-hidden="true"
        ></span>

        <div class="relative mt-auto max-w-[30rem]">
          <h2 class="m-0 text-4xl leading-[1.1] font-semibold tracking-tight">
            Know what expires<br />before it does.
          </h2>
          <p class="mt-4 mb-0 text-[15px] leading-relaxed text-zinc-400">
            Every technology in every customer environment, with the date its
            support ends and a record of who changed what.
          </p>

          <dl class="mt-9 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
            @for (fact of facts; track fact.label) {
              <div>
                <dt class="m-0 text-xs text-zinc-400">{{ fact.label }}</dt>
                <dd class="tabular m-0 text-2xl font-semibold">{{ fact.value }}</dd>
              </div>
            }
          </dl>
        </div>

        <div class="relative mt-10 -mx-10">
          <p class="mb-3 px-10 text-xs font-medium tracking-widest text-zinc-500 uppercase">
            Lifecycles we track
          </p>
          <lime-tech-marquee [row]="1" />
          <div class="mt-3">
            <lime-tech-marquee [row]="2" [reverse]="true" />
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class AuthLayout {
  readonly heading = input.required<string>();
  readonly subheading = input.required<string>();

  protected readonly facts = [
    { label: 'Tracked', value: '477' },
    { label: 'Environments', value: '3' },
    { label: 'Notice', value: '180 d' },
  ];
}
