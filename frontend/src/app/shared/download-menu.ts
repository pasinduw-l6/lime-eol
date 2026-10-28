import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, input, output, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { ReportFormat } from '../core/report-download';

/**
 * A download button that asks for PDF or Word. The menu opens in the page-level overlay,
 * so a card with overflow hidden, or the card below it, can never cover it.
 */
@Component({
  selector: 'lime-download-menu',
  imports: [HlmButton, CdkOverlayOrigin, CdkConnectedOverlay],
  host: { class: 'inline-block' },
  template: `
    <button
      type="button"
      hlmBtn
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [variant]="variant()"
      [size]="size()"
      class="gap-1.5"
      [disabled]="busy()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ busy() ? 'Preparing…' : label() }}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="outside($event, origin.elementRef.nativeElement)"
      (overlayKeydown)="$event.key === 'Escape' && open.set(false)"
      (detach)="open.set(false)"
    >
      <div role="menu" class="min-w-[190px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <button type="button" role="menuitem" class="item" (click)="choose('pdf')">
          <span class="badge pdf">PDF</span>
          <span><span class="block">PDF</span><span class="block text-[11px] text-muted-foreground">Ready to send</span></span>
        </button>
        <button type="button" role="menuitem" class="item" (click)="choose('docx')">
          <span class="badge word">W</span>
          <span><span class="block">Word (.docx)</span><span class="block text-[11px] text-muted-foreground">Editable</span></span>
        </button>
      </div>
    </ng-template>
  `,
  styles: `
    .item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.6rem;
      border-radius: 0.375rem;
      padding: 0.4rem 0.5rem;
      text-align: left;
      font-size: 13px;
    }
    .item:hover,
    .item:focus-visible {
      background: var(--accent);
      outline: none;
    }
    .badge {
      display: grid;
      width: 1.6rem;
      height: 1.6rem;
      place-items: center;
      border-radius: 0.3rem;
      font-size: 9px;
      font-weight: 700;
      color: #fff;
    }
    .pdf {
      background: #b42318;
    }
    .word {
      background: #185abd;
      font-size: 12px;
    }
  `,
})
export class DownloadMenu {
  readonly label = input('Download');
  readonly busy = input(false);
  readonly variant = input<'default' | 'outline'>('default');
  readonly size = input<'default' | 'sm'>('default');
  readonly pick = output<ReportFormat>();

  protected readonly open = signal(false);

  /** Below the button, right edges aligned; above it when there is no room below. */
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected choose(format: ReportFormat): void {
    this.open.set(false);
    this.pick.emit(format);
  }

  /** The button toggles the menu itself, so a click on it is not an outside click. */
  protected outside(event: MouseEvent, button: HTMLElement): void {
    if (!button.contains(event.target as Node)) this.open.set(false);
  }
}
