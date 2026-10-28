import { Component } from '@angular/core';

/**
 * A 3D heart that lives the same 7-second life as the heartbeat line: strong green beats while
 * supported, weaker amber beats on security fixes, then it stops and turns red at end of life.
 * Depth comes from stacked copies of the shape in CSS 3D; no 3D library.
 */
@Component({
  selector: 'lime-eol-heart',
  host: { class: 'inline-block', 'aria-hidden': 'true' },
  template: `
    <div class="stage">
      <span class="glow"></span>
      <div class="spin">
        <div class="beat">
          @for (z of layers; track z; let last = $last) {
            <svg class="layer" [class.front]="last" viewBox="0 0 100 90" [style.transform]="'translateZ(' + z + 'px)'">
              <defs>
                <radialGradient [attr.id]="'shine' + z" cx="0.32" cy="0.3" r="0.75">
                  <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
                  <stop offset="0.35" stop-color="#fff" stop-opacity="0.08" />
                  <stop offset="1" stop-color="#000" stop-opacity="0.35" />
                </radialGradient>
              </defs>
              <path [attr.d]="shape" fill="currentColor" />
              @if (last) {
                <path [attr.d]="shape" [attr.fill]="'url(#shine' + z + ')'" />
              }
            </svg>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      --life: 7s;
      width: 112px;
      height: 112px;
    }
    .stage {
      position: relative;
      width: 100%;
      height: 100%;
      perspective: 520px;
    }
    .glow {
      position: absolute;
      inset: 18%;
      border-radius: 50%;
      background: currentColor;
      filter: blur(26px);
      opacity: 0.55;
      color: #4ade80;
      animation: life-colour var(--life) ease-in-out infinite, glow-beat var(--life) ease-in-out infinite;
    }
    .spin {
      position: absolute;
      inset: 12%;
      transform-style: preserve-3d;
      animation: turn 9s ease-in-out infinite alternate;
    }
    .beat {
      position: absolute;
      inset: 0;
      transform-style: preserve-3d;
      color: #4ade80;
      animation: life-colour var(--life) ease-in-out infinite, life-beat var(--life) linear infinite;
    }
    .layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      filter: brightness(0.55);
    }
    .layer.front {
      filter: none;
    }
    @keyframes turn {
      from {
        transform: rotateY(-32deg) rotateX(8deg);
      }
      to {
        transform: rotateY(32deg) rotateX(-4deg);
      }
    }
    /* Green while supported, amber on security fixes, red from end of life, back to green on loop. */
    @keyframes life-colour {
      0%,
      40% {
        color: #4ade80;
      }
      52%,
      62% {
        color: #f59e0b;
      }
      70%,
      92% {
        color: #ef4444;
      }
      100% {
        color: #4ade80;
      }
    }
    /* Three strong beats, two weaker, one flicker, then still. */
    @keyframes life-beat {
      0%, 4%, 10%, 17%, 23%, 30%, 36%, 46%, 50%, 56%, 60%, 64%, 67%, 100% {
        transform: scale(1);
      }
      6%, 19%, 32% {
        transform: scale(1.16);
      }
      8%, 21%, 34% {
        transform: scale(0.97);
      }
      48%, 58% {
        transform: scale(1.07);
      }
      65.5% {
        transform: scale(1.03);
      }
      70%, 92% {
        transform: scale(0.94);
      }
    }
    @keyframes glow-beat {
      0%, 40% {
        opacity: 0.6;
      }
      55% {
        opacity: 0.4;
      }
      70%, 92% {
        opacity: 0.2;
      }
      100% {
        opacity: 0.6;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .glow,
      .spin,
      .beat {
        animation: none;
      }
      .spin {
        transform: rotateY(-20deg);
      }
    }
  `,
})
export class EolHeart {
  protected readonly shape =
    'M50 88 C22 68 2 50 2 28 C2 13 13 2 28 2 C38 2 45 8 50 16 C55 8 62 2 72 2 C87 2 98 13 98 28 C98 50 78 68 50 88 Z';

  /** Depth in px for each copy, back to front; the last one is the shaded face. */
  protected readonly layers = Array.from({ length: 14 }, (_, i) => i - 7);
}
