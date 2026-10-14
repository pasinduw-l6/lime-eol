import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import PizZip from 'pizzip';
import { ProjectDto } from '../projects/dto/project-response.dto';
import { CHART_WIDTH, chartHeight } from './report-chart';
import { Axis, fmt, fmtLong, ReportSection, Row, span, Status, STATUS_INFO, story } from './report-data';

export interface Chart {
  png: Buffer;
  width: number;
  height: number;
}

const FLAGS: Record<Status, string> = { EOL: 'eol', NEAR: 'near', SUPPORTED: 'ok', UNKNOWN: 'unknown' };

/** The values every {tag} in templates/eol-report.docx is filled with. */
export function templateData(input: {
  title: string;
  projects: ProjectDto[];
  rows: Row[];
  sections: ReportSection[];
  axis: Axis;
  asOf: Date;
  everything: boolean;
}) {
  const { projects, rows, sections, asOf } = input;
  const single = !input.everything && projects.length === 1 ? projects[0] : null;
  const next = rows.filter((r) => r.days !== null && r.days > 0).sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];

  return {
    footerTitle: `Technology End-of-Life Report · ${input.title}`,
    subtitle: input.everything ? 'All projects' : (projects[0]?.customer ?? ''),
    single: !!single,
    projectName: single?.name ?? '',
    projectCode: single?.code ?? '',
    environments: single ? environmentsOf(single) : '',
    projectList: projects.map((p) => (input.everything ? `${p.customer} ${p.name}` : p.name)).join(', '),
    reportDate: fmtLong(asOf),
    technologyCount: rows.length,
    preparedBy: 'Lime · SRE / DevOps',
    eolCount: rows.filter((r) => r.status === 'EOL').length,
    nearCount: rows.filter((r) => r.status === 'NEAR').length,
    supportedCount: rows.filter((r) => r.status === 'SUPPORTED').length,
    nextName: next ? `${next.technology} ${next.version}` : 'None upcoming',
    nextWhen: next ? `${fmt(next.endOfSupport)} (${span(next.days ?? 0)})` : '',
    projects: sections.map((s) => ({
      heading: s.heading,
      chart: s.projectId,
      groups: s.groups.map((g) => ({
        ...flags(g.status),
        title: STATUS_INFO[g.status].heading,
        count: g.rows.length,
        meaning: STATUS_INFO[g.status].meaning,
        rows: g.rows.map((r) => ({
          ...flags(r.status),
          name: `${r.technology} ${r.version}`,
          kind: r.kind,
          environments: r.environments.join(', '),
          released: fmt(r.released),
          hasFull: !!r.fullSupportEnds,
          fullLabel: r.fullSupportEnds && Date.parse(r.fullSupportEnds) < asOf.getTime() ? 'Full support ended' : 'Full support ends',
          fullDate: fmt(r.fullSupportEnds),
          endLabel: r.days !== null && r.days <= 0 ? 'All support ended' : 'All support ends',
          endDate: fmt(r.endOfSupport),
          story: story(r, asOf),
          newest: r.newest ?? '—',
        })),
      })),
    })),
  };
}

function flags(status: Status) {
  return { eol: false, near: false, ok: false, unknown: false, [FLAGS[status]]: true };
}

function environmentsOf(project: ProjectDto): string {
  const order = ['DEV', 'UAT', 'PROD'];
  return project.environments
    .map((e) => e.environment)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .join(', ');
}

/** Fills the Word template. Each {%chart} tag holds a project id and becomes that project's timeline picture. */
export function fillTemplate(template: Buffer, data: ReturnType<typeof templateData>, charts: Map<string, Chart>): Buffer {
  const images = new ImageModule({
    centered: false,
    getImage: (key: string) => charts.get(key)?.png ?? EMPTY_PNG,
    getSize: (_image: Buffer, key: string) => {
      const chart = charts.get(key);
      return chart ? [chart.width, chart.height] : [1, 1];
    },
  });

  const doc = new Docxtemplater(new PizZip(template), {
    modules: [images],
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Display size of a chart in the document, in px at 96 dpi. */
export function chartSize(bars: number): [number, number] {
  return [CHART_WIDTH, chartHeight(bars)];
}

// 1x1 transparent PNG, used if a chart could not be drawn.
const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
