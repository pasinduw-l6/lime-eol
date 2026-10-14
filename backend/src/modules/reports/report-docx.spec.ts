import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { ProjectDto } from '../projects/dto/project-response.dto';
import { chartHtml } from './report-chart';
import { axisFor, rowsOf, sectionsFor, span, story } from './report-data';
import { fillTemplate, templateData } from './report-docx';

const asOf = new Date('2026-10-14T00:00:00Z');

function component(technology: string, version: string, status: string, eolDate: string | null, daysToEol: number | null) {
  return {
    technology,
    componentType: 'OS',
    version,
    cycle: version.split('.')[0],
    eolDate,
    activeSupportEnd: null,
    latestPatch: null,
    daysToEol,
    status,
    eolSource: 'API',
  };
}

const project = {
  id: 'p1',
  name: 'Core Banking',
  customer: 'Demo Bank',
  customerId: 'c1',
  code: 'DBANK',
  environments: [
    { id: 'e1', environment: 'PROD', location: 'ONPREM', locationDetail: null, owners: [], components: [component('RHEL', '7.9', 'EOL', '2024-06-30', -836)] },
    {
      id: 'e2',
      environment: 'DEV',
      location: 'ONPREM',
      locationDetail: null,
      owners: [],
      components: [component('RHEL', '7.9', 'EOL', '2024-06-30', -836), component('MongoDB', '8.0.32', 'SUPPORTED', '2029-10-31', 1113)],
    },
  ],
} as unknown as ProjectDto;

describe('report data', () => {
  it('merges the same version across environments in DEV, UAT, PROD order', () => {
    const rows = rowsOf(project, new Map(), new Map([['RHEL', '9.6']]));
    expect(rows.map((r) => `${r.technology} ${r.environments.join('+')}`)).toEqual(['RHEL DEV+PROD', 'MongoDB DEV']);
    expect(rows[0].newest).toBe('9.6');
  });

  it('describes time in days, then years and months', () => {
    expect(span(13)).toBe('13 days');
    expect(span(836)).toBe('2 years 3 months');
  });

  it('tells how long a version has been without fixes', () => {
    const [rhel] = rowsOf(project, new Map(), new Map());
    expect(story(rhel, asOf)).toBe('Without vendor fixes for 2 years 3 months');
  });
});

describe('Word report', () => {
  it('fills every tag of the default template', () => {
    const perProject = [rowsOf(project, new Map(), new Map())];
    const rows = perProject.flat();
    const axis = axisFor(rows, asOf);
    const sections = sectionsFor([project], perProject, axis, false);
    const data = templateData({ title: 'Demo Bank Core Banking', projects: [project], rows, sections, axis, asOf, everything: false });

    const template = readFileSync(join(__dirname, '../../../templates/eol-report.docx'));
    const file = fillTemplate(template, data, new Map());
    const xml = new PizZip(file).file('word/document.xml')!.asText();

    expect(xml).toContain('Core Banking (DBANK)');
    expect(xml).toContain('Without vendor fixes for 2 years 3 months');
    expect(xml).toContain('DEV, PROD');
    expect(xml).not.toMatch(/\{[#/^%]?[a-zA-Z]+\}/);
  });

  it('draws one bar per technology', () => {
    const rows = rowsOf(project, new Map(), new Map());
    const [section] = sectionsFor([project], [rows], axisFor(rows, asOf), false);
    expect((chartHtml(section.bars, axisFor(rows, asOf)).match(/<text x="0"/g) ?? []).length).toBe(2);
  });
});
