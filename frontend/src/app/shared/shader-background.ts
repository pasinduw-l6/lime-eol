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

/**
 * Flowing colour behind the whole app.
 *
 * One fullscreen triangle and one fragment shader, drawn by OGL — about 12 KB,
 * against ~150 KB for Three.js, which would be a lot of library for a single
 * quad.
 *
 * Deliberately slow and low-contrast. This sits behind live data that someone
 * reads all day, so it has to be atmosphere rather than something the eye keeps
 * returning to.
 */
const VERTEX = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uGround;
  uniform vec3 uTeal;
  uniform vec3 uLime;
  uniform float uStrength;

  /** 1 on the light theme, where the flow is brightness rather than colour. */
  uniform float uLumaMode;
  uniform float uLumaRange;

  varying vec2 vUv;

  // Classic 2D value noise. Cheap, and smooth enough once layered.
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

  /** Layered noise. Four octaves is plenty at this scale and stays cheap. */
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
    // Aspect-corrected, so the flow does not stretch on a wide monitor.
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.035;

    // Domain warping: noise displacing the lookup of more noise, which is what
    // turns flat clouds into something that looks like it is flowing.
    vec2 warp = vec2(
      fbm(p * 1.4 + vec2(t, t * 0.7)),
      fbm(p * 1.4 + vec2(-t * 0.8, t * 0.6) + 5.2)
    );

    float flow = fbm(p * 1.8 + warp * 1.6 + vec2(t * 0.5, -t * 0.4));
    flow = flow * 0.5 + 0.5;

    float teal = smoothstep(0.30, 0.78, flow);
    float lime = smoothstep(0.58, 0.95, flow) * 0.55;

    // Dark theme: the ground tinted toward the brand colours.
    vec3 tinted = uGround;
    tinted = mix(tinted, uTeal, teal * uStrength);
    tinted = mix(tinted, uLime, lime * uStrength);

    // Light theme: the same flow as brightness instead of hue — daylight
    // moving behind frosted glass. A pale tint over a pale ground is a change
    // the eye barely registers, while the same swing in luminance reads
    // immediately, and costs nothing in text contrast because the average
    // brightness does not move.
    float swing = (flow - 0.5) * 2.0;
    vec3 lifted = uGround * (1.0 + swing * uLumaRange);
    // A whisper of teal on the bright bands, so it is not merely grey.
    lifted = mix(lifted, uTeal, smoothstep(0.55, 1.0, flow) * 0.10);

    vec3 colour = mix(tinted, lifted, uLumaMode);

    // Settled toward the flat ground at the edges, so cards near the rim keep
    // their contrast. Held back in luminance mode: the margins are exactly
    // where the light theme's background is visible between cards, and
    // flattening them there would hide the effect where it is needed most.
    float vignette = 1.0 - smoothstep(0.35, 1.25, length(uv - 0.5) * 1.6);
    float base = mix(0.35, 0.74, uLumaMode);
    colour = mix(uGround, colour, base + vignette * (1.0 - base));

    // A little dither. Eight-bit gradients this wide band badly without it.
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    colour += (grain - 0.5) * 0.015;

    gl_FragColor = vec4(colour, 1.0);
  }
`;

/** Brand palette per theme, as the shader wants it: 0-1 linear-ish RGB. */
const PALETTE = {
  dark: {
    ground: [0.027, 0.102, 0.137],
    teal: [0.0, 0.50, 0.47],
    lime: [0.40, 0.64, 0.20],
    strength: 1.0,
    lumaMode: 0,
    lumaRange: 0,
  },
  light: {
    ground: [0.855, 0.898, 0.91],
    teal: [0.42, 0.70, 0.69],
    lime: [0.60, 0.78, 0.45],
    strength: 0.85,
    // Brightness, not hue. A 13% swing either side of the ground is clearly
    // visible while leaving the average where the text needs it.
    lumaMode: 1,
    lumaRange: 0.13,
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
    // Follows the theme switch. Read once at startup, the canvas stayed navy
    // behind a light interface — the background and the cards disagreeing about
    // which theme was on.
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
      program.uniforms['uLumaMode'].value = palette.lumaMode;
      program.uniforms['uLumaRange'].value = palette.lumaRange;

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
        // Half resolution. The image is all soft gradients, so nobody can tell,
        // and it quarters the work on a high-DPI screen.
        dpr: Math.min(window.devicePixelRatio, 2) * 0.5,
      });
    } catch {
      // No WebGL — a locked-down machine, or a browser with it disabled. The
      // app keeps its flat token background and nothing else changes.
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
        uLumaMode: { value: palette.lumaMode },
        uLumaRange: { value: palette.lumaRange },
      },
    });

    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program: this.program });

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(document.body);

    document.addEventListener('visibilitychange', this.onVisibility);

    if (this.still()) {
      // One frame, then nothing: a still image rather than a blank rectangle.
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

    // Releases the GL context rather than waiting for the browser to collect
    // it; they are a limited resource and leaking one breaks the next canvas.
    this.renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** Runs only while the tab is visible, so a background tab costs nothing. */
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

    // Redrawn immediately so a resize is not a frame of stale image.
    if (this.still()) {
      this.draw(0);
    }
  }

  private still(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
