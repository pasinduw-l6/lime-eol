import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Feedback } from './feedback';

export type ReportFormat = 'pdf' | 'docx';

/** Downloads the EOL report as a PDF or an editable Word document. */
@Injectable({ providedIn: 'root' })
export class ReportDownload {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(Feedback);

  /** The report being prepared, e.g. "all" or a project id. */
  readonly busy = signal<string | null>(null);

  project(id: string, format: ReportFormat): void {
    this.save(id, `/api/v1/reports/project/${id}.${format}`, format);
  }

  all(format: ReportFormat): void {
    this.save('all', `/api/v1/reports/all.${format}`, format);
  }

  private save(key: string, path: string, format: ReportFormat): void {
    this.busy.set(key);
    this.http.get(path, { responseType: 'blob', observe: 'response' }).subscribe({
      next: (response) => {
        this.busy.set(null);
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `Lime-EOL-Report.${format}`;
        const url = URL.createObjectURL(response.body!);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.busy.set(null);
        this.feedback.error(
          format === 'pdf'
            ? 'The PDF could not be generated. Check that the PDF service is running.'
            : 'The Word document could not be generated. Check that the PDF service is running.',
        );
      },
    });
  }
}
