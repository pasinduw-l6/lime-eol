// Builds templates/eol-report.docx: the default Word template for the EOL report.
// Every {tag} is filled by docxtemplater at download time (see src/modules/reports/report-docx.ts).
// A company template works the same way: copy these tags into it and save it over templates/eol-report.docx.
//
//   node scripts/make-report-template.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx';

const FONT = 'Segoe UI';
const INK = '101828';
const SOFT = '475467';
const MUTED = '667085';
const LINE = 'D0D5DD';
const RED = 'B42318';
const AMBER = 'B54708';
const GREEN = '067647';
const GREY = '475467';
const LIME = '3F6212';

// A4 with 0.7in side margins: 8.27in - 1.4in of text width.
const TEXT_WIDTH = Math.round((8.27 - 1.4) * 1440);

const run = (text, options = {}) => new TextRun({ text, font: FONT, size: 19, color: INK, ...options });
const para = (children, options = {}) =>
  new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 60 }, ...options });

const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function cell(children, width, options = {}) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: { top: none, left: none, right: none, bottom: thin },
    ...options,
  });
}

// Same status wording and colour, switched by the {#eol} {#near} {#ok} {#unknown} flags.
function byStatus(make) {
  return [
    run('{#eol}'), make(RED), run('{/eol}'),
    run('{#near}'), make(AMBER), run('{/near}'),
    run('{#ok}'), make(GREEN), run('{/ok}'),
    run('{#unknown}'), make(GREY), run('{/unknown}'),
  ];
}

const meta = (label, value) =>
  new TableRow({
    children: [
      cell([para(run(label, { color: MUTED }))], 2400),
      cell([para(value)], TEXT_WIDTH - 2400),
    ],
  });

const cover = [
  para(run('lime', { bold: true, size: 32, color: LIME })),
  new Paragraph({ spacing: { before: 3600 } }),
  para(run('TECHNOLOGY LIFECYCLE', { size: 16, color: MUTED, characterSpacing: 30 })),
  para(run('Technology End-of-Life Report', { bold: true, size: 48 }), { spacing: { after: 120 } }),
  para(run('{subtitle}', { size: 26, color: SOFT })),
  para(run('{#single}{projectName}{/single}', { bold: true, size: 26 })),
  new Paragraph({ spacing: { before: 2400 } }),
  new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    borders: { top: thin, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      meta('Report date', run('{reportDate}')),
      new TableRow({
        children: [
          cell([para(run('{#single}Project', { color: MUTED }))], 2400),
          cell([para(run('{projectName} ({projectCode})'))], TEXT_WIDTH - 2400),
        ],
      }),
      new TableRow({
        children: [
          cell([para(run('Environments', { color: MUTED }))], 2400),
          cell([para(run('{environments}{/single}'))], TEXT_WIDTH - 2400),
        ],
      }),
      new TableRow({
        children: [
          cell([para(run('{^single}Projects', { color: MUTED }))], 2400),
          cell([para(run('{projectList}{/single}'))], TEXT_WIDTH - 2400),
        ],
      }),
      meta('Technologies', run('{technologyCount}')),
      meta('Prepared by', run('{preparedBy}')),
    ],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

const glanceCell = (value, label, colour) =>
  cell(
    [para(run(value, { bold: true, size: 32, color: colour })), para(run(label, { size: 16, color: MUTED }))],
    TEXT_WIDTH / 4,
    { borders: { top: thin, bottom: thin, left: thin, right: thin } },
  );

const glance = new Table({
  width: { size: TEXT_WIDTH, type: WidthType.DXA },
  rows: [
    new TableRow({
      children: [
        glanceCell('{eolCount}', 'Past end of support', RED),
        glanceCell('{nearCount}', 'Ending within 180 days', AMBER),
        glanceCell('{supportedCount}', 'Supported', INK),
        cell(
          [
            para(run('Next end of support', { size: 16, color: MUTED })),
            para(run('{nextName}', { bold: true })),
            para(run('{nextWhen}', { size: 16, color: MUTED })),
          ],
          TEXT_WIDTH / 4,
          { borders: { top: thin, bottom: thin, left: thin, right: thin } },
        ),
      ],
    }),
  ],
});

const COLS = [2300, 1500, TEXT_WIDTH - 2300 - 1500 - 1500, 1500];
const head = (text, width) =>
  cell([para(run(text, { bold: true, size: 16, color: SOFT }))], width, {
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F9FAFB' },
  });

const rowsTable = new Table({
  width: { size: TEXT_WIDTH, type: WidthType.DXA },
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        head('Technology', COLS[0]),
        head('Environments', COLS[1]),
        head('Vendor support', COLS[2]),
        head('Newest vendor version', COLS[3]),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        cell([para(run('{#rows}{name}', { bold: true })), para(run('{kind}', { size: 16, color: MUTED }))], COLS[0]),
        cell([para(run('{environments}', { size: 17 }))], COLS[1]),
        cell(
          [
            para([run('Released  ', { size: 17, color: MUTED }), run('{released}', { size: 17 })]),
            para(run('{#hasFull}')),
            para([run('{fullLabel}  ', { size: 17, color: MUTED }), run('{fullDate}', { size: 17 })]),
            para(run('{/hasFull}')),
            para([run('{endLabel}  ', { size: 17, color: MUTED }), run('{endDate}', { size: 17, bold: true })]),
            para([run('▶ ', { size: 17 }), ...byStatus((colour) => run('{story}', { size: 17, bold: true, color: colour }))]),
          ],
          COLS[2],
        ),
        cell([para(run('{newest}{/rows}', { size: 17 }))], COLS[3]),
      ],
    }),
  ],
});

const details = [
  para(run('Technology end-of-life details', { bold: true, size: 30 }), { spacing: { after: 80 } }),
  para(run('Vendor support position on {reportDate} for every technology in use. Dates come from vendor publications and endoflife.date.', { color: MUTED, size: 17 }), { spacing: { after: 200 } }),
  glance,
  para(run('{#projects}')),
  para(run('{heading}', { bold: true, size: 24 }), { spacing: { before: 360, after: 120 }, keepNext: true }),
  para(run('{%chart}'), { alignment: AlignmentType.LEFT, keepNext: true }),
  para(run('Bar: solid = full support, striped = security fixes only, black line = today. Colour: red ended, amber ending within 180 days, green supported.', { size: 15, color: MUTED }), { spacing: { after: 160 } }),
  para(run('{#groups}')),
  para([...byStatus((colour) => run('{title}', { bold: true, color: colour })), run(' · {count}', { bold: true })], {
    spacing: { before: 200, after: 20 },
    keepNext: true,
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: LINE, space: 6 } },
  }),
  para(run('{meaning}', { size: 16, color: MUTED }), { keepNext: true, spacing: { after: 80 } }),
  rowsTable,
  para(run('{/groups}')),
  para(run('{/projects}')),
];

const footer = new Footer({
  children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
      children: [
        run('{footerTitle}', { size: 15, color: MUTED }),
        new TextRun({ font: FONT, size: 15, color: MUTED, children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES] }),
      ],
    }),
  ],
});

const doc = new Document({
  creator: 'Lime EOL tool',
  title: 'Technology End-of-Life Report',
  styles: { default: { document: { run: { font: FONT, size: 19 } } } },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 864, bottom: 1008, left: 1008, right: 1008, footer: 504 },
        },
      },
      footers: { default: footer },
      children: [...cover, ...details],
    },
  ],
});

mkdirSync(new URL('../templates/', import.meta.url), { recursive: true });
writeFileSync(new URL('../templates/eol-report.docx', import.meta.url), await Packer.toBuffer(doc));
console.log('Wrote templates/eol-report.docx');
