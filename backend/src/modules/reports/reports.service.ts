import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getEnv } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

export type ReportKind = 'project' | 'customer';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async render(kind: ReportKind, id: string, userId: string): Promise<{ file: Buffer; name: string }> {
    const subject = await this.subject(kind, id);
    const env = getEnv();
    const token = this.auth.reportToken(userId);
    const url = `${env.REPORT_BASE_URL.replace(/\/$/, '')}/report/${kind}/${id}#token=${encodeURIComponent(token)}`;

    const side = 0.7;

    const form = new FormData();
    form.append('url', url);
    form.append('paperWidth', '8.27');
    form.append('paperHeight', '11.7');
    form.append('marginTop', '0.6');
    form.append('marginBottom', '0.7');
    form.append('marginLeft', String(side));
    form.append('marginRight', String(side));
    form.append('printBackground', 'true');
    form.append('scale', '1');
    form.append('emulatedMediaType', 'print');
    form.append('waitForExpression', 'window.limeReportReady === true');
    form.append(
      'files',
      new Blob([footer(`Technology End-of-Life Report · ${subject.title}`, side)], { type: 'text/html' }),
      'footer.html',
    );

    let response: Response;
    try {
      response = await fetch(`${env.GOTENBERG_URL.replace(/\/$/, '')}/forms/chromium/convert/url`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      this.logger.error(`PDF service unreachable: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('The PDF service is not reachable.');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`PDF service answered ${response.status}: ${detail.slice(0, 300)}`);
      throw new ServiceUnavailableException('The PDF could not be generated.');
    }

    const date = new Date().toISOString().slice(0, 10);
    return {
      file: Buffer.from(await response.arrayBuffer()),
      name: `Lime-EOL-Report-${slug(subject.title)}-${date}.pdf`,
    };
  }

  private async subject(kind: ReportKind, id: string): Promise<{ title: string }> {
    if (kind === 'customer') {
      const customer = await this.prisma.customer.findFirst({ where: { id, archivedAt: null } });
      if (!customer) throw new NotFoundException(`No customer "${id}"`);
      return { title: customer.name };
    }

    const project = await this.prisma.project.findFirst({
      where: { id, archivedAt: null },
      include: { customer: true },
    });
    if (!project) throw new NotFoundException(`No project "${id}"`);
    return { title: `${project.customer.name} ${project.name}` };
  }
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
}

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function footer(title: string, inset: number): string {
  return `<!doctype html>
<html>
  <head>
    <style>
      html, body { margin: 0; padding: 0; }
      table { width: calc(100% - ${inset * 2}in); margin: 0 ${inset}in; border-collapse: collapse; border-top: 1px solid #d0d5dd; font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; font-size: 8px; color: #667085; }
      td { padding-top: 5px; }
      td.right { text-align: right; white-space: nowrap; }
    </style>
  </head>
  <body>
    <table>
      <tr>
        <td>${escape(title)}</td>
        <td class="right">Page <span class="pageNumber"></span> of <span class="totalPages"></span></td>
      </tr>
    </table>
  </body>
</html>`;
}

