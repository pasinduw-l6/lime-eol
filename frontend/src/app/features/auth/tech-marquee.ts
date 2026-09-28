import { Component, input } from '@angular/core';

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
  readonly row = input<1 | 2>(1);
  readonly reverse = input(false);

  protected doubled(): string[] {
    const logos = this.row() === 1 ? ROW_ONE : ROW_TWO;
    return [...logos, ...logos];
  }
}
