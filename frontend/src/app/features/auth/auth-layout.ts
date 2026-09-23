import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  input,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';

/**
 * The frame both auth pages sit in.
 *
 * Two halves: what the tool is for on the left, the form on the right. The left
 * half is decoration on a phone and is dropped there rather than stacked, so the
 * form is the first thing on screen at every width.
 */
@Component({
  selector: 'lime-auth-layout',
  host: { class: 'block' },
  template: `
    <div class="auth-shell grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <!-- brand half -->
      <aside
        class="relative hidden overflow-hidden px-14 py-12 lg:flex lg:flex-col"
        style="background: linear-gradient(150deg, var(--color-accent-deep), var(--color-ground) 58%)"
      >
        <!-- the lime in the mark, bled into the corner -->
        <span
          class="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full"
          style="background: radial-gradient(circle, color-mix(in oklab, var(--color-lime) 38%, transparent), transparent 68%)"
          aria-hidden="true"
        ></span>

        <span class="brand-plate relative inline-flex w-fit">
          <img src="/nav-logo.png" alt="Lime" class="h-7 w-auto" />
        </span>

        <div class="relative mt-auto max-w-[30rem]">
          <h2
            class="m-0 text-[40px] leading-[1.1] font-semibold tracking-[-0.03em] text-white"
          >
            Know what expires<br />before it does.
          </h2>
          <p class="mt-4 mb-0 text-[15px] leading-relaxed text-white/70">
            Every technology in every customer environment, with the date its
            support ends and a record of who changed what.
          </p>

          <dl class="mt-9 grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            @for (fact of facts; track fact.label) {
              <div class="auth-fact">
                <dt class="m-0 text-[12px] text-white/55">{{ fact.label }}</dt>
                <dd class="tabular m-0 text-[22px] font-semibold text-white">
                  {{ fact.value }}
                </dd>
              </div>
            }
          </dl>
        </div>
      </aside>

      <!-- form half -->
      <main class="flex flex-col px-5 py-8 sm:px-10">
        <!-- No theme switch here: these two pages are dark either way, and a
             control that appears to do nothing is worse than none. -->
        <span class="brand-plate inline-flex w-fit lg:invisible">
          <img src="/nav-logo.png" alt="Lime" class="h-6 w-auto" />
        </span>

        <div #panel class="m-auto w-full max-w-[26rem] py-10">
          <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">
            {{ heading() }}
          </h1>
          <p class="mt-1.5 mb-7 text-[14px] text-ink-soft">{{ subheading() }}</p>

          <ng-content />
        </div>
      </main>
    </div>
  `,
  styles: `
    .auth-fact {
      animation: fact-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .auth-fact:nth-child(2) {
      animation-delay: 80ms;
    }
    .auth-fact:nth-child(3) {
      animation-delay: 160ms;
    }

    @keyframes fact-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class AuthLayout implements AfterViewInit, OnDestroy {
  readonly heading = input.required<string>();
  readonly subheading = input.required<string>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private tween?: gsap.core.Tween;

  ngAfterViewInit(): void {
    const panel = this.panel()?.nativeElement;

    if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.tween = gsap.from(panel, {
      opacity: 0,
      y: 14,
      duration: 0.45,
      ease: 'power3.out',
      clearProps: 'opacity,transform',
    });
  }

  ngOnDestroy(): void {
    // kill(), not revert(): reverting a .from() would leave the panel invisible.
    this.tween?.kill();
  }

  /**
   * Deliberately fixed, not live figures.
   *
   * This page is shown to someone who is not signed in; reading real counts out
   * of the estate here would leak how many customers there are and what is
   * failing, to anyone who loads the URL.
   */
  protected readonly facts = [
    { label: 'Tracked', value: '477' },
    { label: 'Environments', value: '3' },
    { label: 'Notice', value: '180 d' },
  ];
}
