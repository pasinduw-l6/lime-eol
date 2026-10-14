import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getEnv } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AccessService } from '../access/access.service';
import { AuthService } from '../auth/auth.service';
import { ProjectsService } from '../projects/projects.service';
import { CHART_SCALE, chartHtml } from './report-chart';
import { axisFor, CycleFacts, rowsOf, sectionsFor } from './report-data';
import { Chart, chartSize, fillTemplate, templateData } from './report-docx';

export type ReportKind = 'project' | 'all';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly access: AccessService,
    private readonly projects: ProjectsService,
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


  async renderDocx(kind: ReportKind, id: string, userId: string): Promise<{ file: Buffer; name: string }> {
    const subject = await this.subject(kind, id);
    const [scope, all, cycles] = await Promise.all([
      this.access.scope(userId),
      this.projects.findAll(),
      this.prisma.technologyCycle.findMany({ include: { technology: { select: { name: true } } } }),
    ]);

    const everything = kind === 'all';
    const projects = all
      .filter((p) => this.access.levelIn(scope, p.id) !== null && (everything || p.id === id))
      .sort((a, b) => a.customer.localeCompare(b.customer) || a.name.localeCompare(b.name));
    if (!everything && projects.length === 0) throw new NotFoundException(`No project "${id}"`);

    const facts = new Map<string, CycleFacts>();
    const newestCycle = new Map<string, { at: string; value: string }>();
    for (const c of cycles) {
      const released = c.releaseDate ? c.releaseDate.toISOString().slice(0, 10) : null;
      facts.set(`${c.technology.name}|${c.cycle}`, { releaseDate: released });
      const best = newestCycle.get(c.technology.name);
      if (!best || (released ?? '') > best.at) {
        newestCycle.set(c.technology.name, { at: released ?? '', value: c.latestPatch ?? c.cycle });
      }
    }
    const newest = new Map([...newestCycle].map(([name, n]) => [name, n.value]));

    const asOf = new Date();
    const perProject = projects.map((p) => rowsOf(p, facts, newest));
    const rows = perProject.flat();
    const axis = axisFor(rows, asOf);
    const sections = sectionsFor(projects, perProject, axis, everything);

    const charts = new Map<string, Chart>();
    await Promise.all(
      sections.map(async (s) => {
        const [width, height] = chartSize(s.bars.length);
        const png = await this.screenshot(chartHtml(s.bars, axis), width * CHART_SCALE, height * CHART_SCALE);
        charts.set(s.projectId, { png, width, height });
      }),
    );

    const template = await readFile(join(process.cwd(), 'templates', 'eol-report.docx'));
    const data = templateData({ title: subject.title, projects, rows, sections, axis, asOf, everything });
    const date = asOf.toISOString().slice(0, 10);
    return {
      file: fillTemplate(template, data, charts),
      name: `Lime-EOL-Report-${slug(subject.title)}-${date}.docx`,
    };
  }

  private async screenshot(html: string, width: number, height: number): Promise<Buffer> {
    const env = getEnv();
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('width', String(width));
    form.append('height', String(height));
    form.append('clip', 'true');
    form.append('format', 'png');

    let response: Response;
    try {
      response = await fetch(`${env.GOTENBERG_URL.replace(/\/$/, '')}/forms/chromium/screenshot/html`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      this.logger.error(`PDF service unreachable: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('The document service is not reachable.');
    }
    if (!response.ok) {
      this.logger.error(`Chart screenshot answered ${response.status}`);
      throw new ServiceUnavailableException('The report chart could not be drawn.');
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async subject(kind: ReportKind, id: string): Promise<{ title: string }> {
    if (kind === 'all') {
      return { title: 'All projects' };
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

