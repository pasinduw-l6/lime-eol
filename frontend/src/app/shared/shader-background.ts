import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { Theme } from '../core/theme';

const VERTEX =  `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT =  `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uGround;
  uniform vec3 uTeal;
  uniform vec3 uLime;
  uniform float uStrength;

  uniform float uEdgeFloor;

  varying vec2 vUv;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
      total += noise(p) * amplitude;
      p *= 2.0;
      amplitude *= 0.5;
    }
    return total;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.035;

    vec2 warp = vec2(
      fbm(p * 1.4 + vec2(t, t * 0.7)),
      fbm(p * 1.4 + vec2(-t * 0.8, t * 0.6) + 5.2)
    );

    float flow = fbm(p * 1.8 + warp * 1.6 + vec2(t * 0.5, -t * 0.4));
    flow = flow * 0.5 + 0.5;

    float teal = smoothstep(0.30, 0.78, flow);
    float lime = smoothstep(0.58, 0.95, flow) * 0.55;

    vec3 colour = uGround;
    colour = mix(colour, uTeal, teal * uStrength);
    colour = mix(colour, uLime, lime * uStrength);

    float vignette = 1.0 - smoothstep(0.35, 1.25, length(uv - 0.5) * 1.6);
    colour = mix(uGround, colour, uEdgeFloor + vignette * (1.0 - uEdgeFloor));

    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    colour += (grain - 0.5) * 0.015;

    gl_FragColor = vec4(colour, 1.0);
  }
`;

const PALETTE = {
  dark: {
    ground: [0.027, 0.102, 0.137],
    teal: [0.0, 0.50, 0.47],
    lime: [0.40, 0.64, 0.20],
    strength: 1.0,
    edgeFloor: 0.35,
  },
  light: {
    ground: [0.902, 0.937, 0.941],
    teal: [0.32, 0.68, 0.62],
    lime: [0.36, 0.62, 0.16],
    strength: 1.0,
    edgeFloor: 0.58,
  },
} as const;

@Component({
  selector: 'lime-shader-background',
  host: { class: 'contents' },
  template: `
    <canvas
      #canvas
      class="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      aria-hidden="true"
    ></canvas>
  `,
})
export class ShaderBackground implements AfterViewInit, OnDestroy {
  private readonly theme = inject(Theme);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      const mode = this.theme.mode();
      const program = this.program;

      if (!program) {
        return;
      }

      const palette = PALETTE[mode === 'light' ? 'light' : 'dark'];
      program.uniforms['uGround'].value = [...palette.ground];
      program.uniforms['uTeal'].value = [...palette.teal];
      program.uniforms['uLime'].value = [...palette.lime];
      program.uniforms['uStrength'].value = palette.strength;
      program.uniforms['uEdgeFloor'].value = palette.edgeFloor;

      if (this.still()) {
        this.draw(0);
      }
    });
  }

  private renderer?: Renderer;
  private program?: Program;
  private mesh?: Mesh;
  private frame?: number;
  private observer?: ResizeObserver;
  private readonly onVisibility = () => this.pump();

  ngAfterViewInit(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) {
      return;
    }

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        canvas,
        alpha: false,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio, 2) * 0.5,
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    const palette = PALETTE[this.theme.mode() === 'light' ? 'light' : 'dark'];

    this.renderer = renderer;
    this.program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1] },
        uGround: { value: [...palette.ground] },
        uTeal: { value: [...palette.teal] },
        uLime: { value: [...palette.lime] },
        uStrength: { value: palette.strength },
        uEdgeFloor: { value: palette.edgeFloor },
      },
    });

    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program: this.program });

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(document.body);

    document.addEventListener('visibilitychange', this.onVisibility);

    if (this.still()) {
      this.draw(0);
      return;
    }

    this.pump();
  }

  ngOnDestroy(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);

    this.renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private pump(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }

    if (document.hidden || this.still()) {
      return;
    }

    const loop = (time: number) => {
      this.draw(time);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private draw(time: number): void {
    if (!this.renderer || !this.mesh || !this.program) {
      return;
    }

    this.program.uniforms['uTime'].value = time * 0.001;
    this.renderer.render({ scene: this.mesh });
  }

  private resize(): void {
    if (!this.renderer || !this.program) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.program.uniforms['uResolution'].value = [width, height];

    if (this.still()) {
      this.draw(0);
    }
  }

  private still(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
