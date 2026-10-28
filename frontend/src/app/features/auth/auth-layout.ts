import { Component, input } from '@angular/core';
import { EolHeart } from './eol-heart';
import { TechMarquee } from './tech-marquee';

/** One dark screen: the message and the sign-in card side by side, the lifecycles strip below. */
@Component({
  selector: 'lime-auth-layout',
  imports: [TechMarquee, EolHeart],
  host: { class: 'block' },
  template: `
    <div class="relative flex min-h-svh flex-col overflow-hidden bg-zinc-950 text-white">
      <span
        class="pointer-events-none absolute -top-32 -right-32 h-[460px] w-[460px] rounded-full opacity-40 blur-3xl"
        style="background: var(--primary)"
        aria-hidden="true"
      ></span>

      <header class="relative p-6 md:p-10">
        <span class="brand-plate w-fit rounded-md bg-white px-2.5 py-1">
          <img src="/nav-logo.png" alt="Lime" class="h-6 w-auto" />
        </span>
      </header>

      <main class="relative flex flex-1 items-center px-6 md:px-10">
        <div class="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_400px]">
          <div class="max-w-[34rem]">
            <p class="m-0 text-xs font-medium tracking-[0.3em] text-zinc-500 uppercase">Lime lifecycle</p>
            <div class="mt-1 flex items-center gap-4">
              <h2 class="eol-title m-0 text-6xl leading-none font-bold tracking-tight md:text-7xl">End of Life</h2>
              <lime-eol-heart class="shrink-0 scale-75 md:scale-100" />
            </div>
            <p class="m-0 mt-4 text-2xl font-semibold tracking-tight">Know what expires before it does.</p>

            <!-- A version's life as a heartbeat: strong while supported, weaker on security fixes, flat at end of life. -->
            <div class="mt-8" aria-hidden="true">
              <svg class="pulse" viewBox="0 0 600 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eol-life" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0">
                    <stop offset="0" stop-color="#4ade80" />
                    <stop offset="0.45" stop-color="#4ade80" />
                    <stop offset="0.55" stop-color="#f59e0b" />
                    <stop offset="0.7" stop-color="#f59e0b" />
                    <stop offset="0.78" stop-color="#ef4444" />
                    <stop offset="1" stop-color="#ef4444" />
                  </linearGradient>
                </defs>
                <path class="track" [attr.d]="beat" />
                <path class="beat" [attr.d]="beat" pathLength="1" stroke="url(#eol-life)" />
                <line class="eol-line" x1="462" y1="8" x2="462" y2="92" />
              </svg>
              <div class="relative mt-1 h-5 text-[11px] font-medium text-zinc-400">
                <span class="absolute left-0 flex items-center gap-1.5"><i class="dot bg-green-400"></i>Supported</span>
                <span class="absolute left-[46%] flex items-center gap-1.5"><i class="dot bg-amber-500"></i><span class="hidden sm:inline">Security fixes only</span><span class="sm:hidden">Security</span></span>
                <span class="eol-tag absolute left-[77%] rounded-full bg-red-500 px-2 py-px text-[10px] font-bold tracking-wider text-white">EOL</span>
              </div>
            </div>

            <p class="mt-6 mb-0 text-[15px] leading-relaxed text-zinc-400">
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

          <div class="animate-in fade-in-0 slide-in-from-bottom-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur duration-300">
            <div class="mb-6 flex flex-col gap-1.5 text-center">
              <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ heading() }}</h1>
              <p class="m-0 text-sm text-balance text-zinc-400">{{ subheading() }}</p>
            </div>

            <ng-content />
          </div>
        </div>
      </main>

      <footer class="relative mt-10 pb-8">
        <p class="mb-3 px-6 text-xs font-medium tracking-widest text-zinc-500 uppercase md:px-10">
          Lifecycles we track
        </p>
        <lime-tech-marquee [row]="1" />
        <div class="mt-3">
          <lime-tech-marquee [row]="2" [reverse]="true" />
        </div>
      </footer>
    </div>
  `,
  styles: `
    .eol-title {
      background: linear-gradient(90deg, #4ade80, #a3e635, #f59e0b, #ef4444, #f59e0b, #4ade80);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: eol-shift 10s linear infinite;
    }
    .pulse {
      display: block;
      width: 100%;
      height: 90px;
      overflow: visible;
    }
    .pulse path {
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pulse .track {
      stroke: rgb(255 255 255 / 0.07);
    }
    .pulse .beat {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      filter: drop-shadow(0 0 6px rgb(74 222 128 / 0.35));
      animation: eol-draw 7s ease-in-out infinite;
    }
    .pulse .eol-line {
      stroke: #ef4444;
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
      opacity: 0;
      animation: eol-mark 7s ease-in-out infinite;
    }
    .eol-tag {
      opacity: 0;
      transform: translateX(-50%);
      animation: eol-mark 7s ease-in-out infinite;
    }
    .dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    @keyframes eol-shift {
      to {
        background-position: 300% 0;
      }
    }
    @keyframes eol-draw {
      0% {
        stroke-dashoffset: 1;
      }
      70%,
      90% {
        stroke-dashoffset: 0;
        opacity: 1;
      }
      100% {
        stroke-dashoffset: 0;
        opacity: 0;
      }
    }
    @keyframes eol-mark {
      0%,
      58% {
        opacity: 0;
      }
      66%,
      90% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .eol-title,
      .pulse .beat,
      .pulse .eol-line,
      .eol-tag {
        animation: none;
      }
      .pulse .beat {
        stroke-dashoffset: 0;
      }
      .pulse .eol-line,
      .eol-tag {
        opacity: 1;
      }
    }
  `,
})
export class AuthLayout {
  readonly heading = input.required<string>();
  readonly subheading = input.required<string>();

  /** Strong beats while supported, smaller on security fixes, one last flicker, then flat. */
  protected readonly beat =
    'M0 50 L40 50 L48 16 L58 86 L68 38 L76 50 L130 50 L138 16 L148 86 L158 38 L166 50 L220 50 L228 16 L238 86 L248 38 ' +
    'L256 50 L310 50 L316 32 L323 66 L330 45 L336 50 L385 50 L390 40 L396 59 L402 47 L407 50 L445 50 L449 45 L453 54 ' +
    'L457 50 L600 50';

  protected readonly facts = [
    { label: 'Tracked', value: '477' },
    { label: 'Environments', value: '3' },
    { label: 'Notice', value: '180 d' },
  ];
}
