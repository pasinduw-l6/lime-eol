import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; run: () => void };
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (answer: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class Feedback {
  private nextId = 1;

  readonly toasts = signal<Toast[]>([]);
  readonly pending = signal<PendingConfirm | null>(null);

  success(message: string, action?: Toast['action']): void {
    this.push({ tone: 'success', message, action });
  }

  error(message: string): void {
    this.push({ tone: 'error', message });
  }

  info(message: string): void {
    this.push({ tone: 'info', message });
  }

  failed(err: unknown, fallback: string): void {
    const detail = (err as { error?: { message?: string | string[] } })?.error?.message;
    this.error(Array.isArray(detail) ? detail.join('. ') : (detail ?? fallback));
  }

  dismiss(id: number): void {
    this.toasts.update((all) => all.filter((t) => t.id !== id));
  }

  confirm(request: ConfirmRequest): Promise<boolean> {
    return new Promise((resolve) => this.pending.set({ ...request, resolve }));
  }

  answer(value: boolean): void {
    const pending = this.pending();
    this.pending.set(null);
    pending?.resolve(value);
  }

  private push(toast: Omit<Toast, 'id'>): void {
    const id = this.nextId++;
    this.toasts.update((all) => [...all.slice(-3), { ...toast, id }]);
    setTimeout(() => this.dismiss(id), toast.tone === 'error' ? 8000 : 5000);
  }
}
