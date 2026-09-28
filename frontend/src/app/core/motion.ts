import { ElementRef, Injectable } from '@angular/core';
import gsap from 'gsap';

@Injectable({ providedIn: 'root' })
export class Motion {
  private get animates(): boolean {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  countUp(target: ElementRef<HTMLElement> | HTMLElement, to: number): void {
    const element = target instanceof ElementRef ? target.nativeElement : target;
    if (!element) {
      return;
    }

    if (!this.animates) {
      element.textContent = String(to);
      return;
    }

    const state = { value: 0 };
    gsap.to(state, {
      value: to,
      duration: Math.min(0.8, 0.25 + to * 0.05),
      ease: 'power2.out',
      onUpdate: () => {
        element.textContent = String(Math.round(state.value));
      },
    });
  }

  stagger(
    host: ElementRef<HTMLElement>,
    selector: string,
    options: { y?: number; each?: number } = {},
  ): void {
    const targets = this.targets(host, selector);
    if (!targets) {
      return;
    }

    gsap.from(targets, {
      opacity: 0,
      y: options.y ?? 8,
      duration: 0.36,
      ease: 'power2.out',
      stagger: options.each ?? 0.04,
      clearProps: 'opacity,transform',
    });
  }

  grow(host: ElementRef<HTMLElement>, selector: string): void {
    const targets = this.targets(host, selector);
    if (!targets) {
      return;
    }

    gsap.from(targets, {
      scaleY: 0,
      transformOrigin: 'bottom center',
      duration: 0.4,
      ease: 'power3.out',
      stagger: 0.02,
      clearProps: 'transform',
    });
  }

  private targets(
    host: ElementRef<HTMLElement>,
    selector: string,
  ): NodeListOf<Element> | null {
    if (!this.animates) {
      return null;
    }
    const found = host.nativeElement.querySelectorAll(selector);
    return found.length > 0 ? found : null;
  }
}
