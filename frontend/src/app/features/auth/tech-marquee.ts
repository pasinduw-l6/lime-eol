import { Component, input } from '@angular/core';

/**
 * Logos of things the registry tracks, sliding past.
 *
 * Hardcoded rather than read from the API: this sits on a page nobody has
 * signed in to yet, and the estate's real contents are not public. These are
 * simply well-known products endoflife.date publishes.
 *
 * CSS rather than GSAP. A marquee is one constant linear translation with no
 * timeline to orchestrate, so keyframes run it on the compositor and cost
 * nothing per frame; a JS ticker here would be more code doing less well.
 */
const ROW_ONE = [
  'docker',
  'kubernetes',
  'redhat',
  'mongodb',
  'postgresql',
  'redis',
  'nginx',
  'nodedotjs',
  'python',
  'apachekafka',
];

const ROW_TWO = [
  'ubuntu',
  'openjdk',
  'springboot',
  'elasticsearch',
  'rabbitmq',
  'terraform',
  'jenkins',
  'grafana',
  'ansible',
  'apachetomcat',
];

@Component({
  selector: 'lime-tech-marquee',
  host: { class: 'block' },
  template: `
    <div class="marquee-mask overflow-hidden">
      <!-- The list is rendered twice and the track slides exactly half its
           width, so the second copy lands where the first began and the loop
           has no seam. -->
      <div class="marquee-track" [class.reverse]="reverse()">
        @for (slug of doubled(); track $index) {
          <span class="marquee-cell" aria-hidden="true">
            <img
              [src]="'https://cdn.simpleicons.org/' + slug + '/e9f4f5'"
              height="26"
              alt=""
              loading="lazy"
            />
          </span>
        }
      </div>
    </div>
  `,
  styles: `
    .marquee-mask {
      /* Logos fade out at both ends rather than being cut off mid-stroke. */
      -webkit-mask-image: linear-gradient(
        to right,
        transparent,
        #000 8%,
        #000 92%,
        transparent
      );
      mask-image: linear-gradient(
        to right,
        transparent,
        #000 8%,
        #000 92%,
        transparent
      );
    }

    .marquee-track {
      display: flex;
      width: max-content;
      animation: marquee 38s linear infinite;
    }

    .marquee-track.reverse {
      animation-direction: reverse;
      animation-duration: 46s;
    }

    /* A fixed cell width, not a gap: each item then occupies exactly the same
       space, so translating half the track is precisely one full copy. */
    .marquee-cell {
      display: grid;
      place-items: center;
      width: 116px;
      flex: none;
      opacity: 0.62;
    }

    .marquee-cell img {
      height: 26px;
      width: auto;
      max-width: 88px;
      object-fit: contain;
    }

    @keyframes marquee {
      from {
        transform: translate3d(0, 0, 0);
      }
      to {
        transform: translate3d(-50%, 0, 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .marquee-track {
        animation: none;
      }
    }
  `,
})
export class TechMarquee {
  /** Which row of logos, and which way it travels. */
  readonly row = input<1 | 2>(1);
  readonly reverse = input(false);

  /** The row twice over, which is what makes the loop seamless. */
  protected doubled(): string[] {
    const logos = this.row() === 1 ? ROW_ONE : ROW_TWO;
    return [...logos, ...logos];
  }
}
