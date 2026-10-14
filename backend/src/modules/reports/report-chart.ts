import { Axis, Bar } from './report-data';

// The support timeline drawn as SVG, the same picture as the PDF report.
// Laid out at 660 x height (the Word text width in px) and rendered at 2x for print sharpness.

export const CHART_WIDTH = 660;
export const CHART_SCALE = 2;

const LABEL = 150;
const ROW = 22;
const TOP = 6;
const AXIS = 20;

export function chartHeight(bars: number): number {
  return TOP + Math.max(bars, 1) * ROW + AXIS;
}

export function chartHtml(bars: Bar[], axis: Axis): string {
  const height = chartHeight(bars.length);
  const track = CHART_WIDTH - LABEL - 8;
  const x = (t: number) => LABEL + ((t - axis.from) / (axis.to - axis.from)) * track;
  const bottom = TOP + bars.length * ROW;

  const colours = [...new Set(bars.map((b) => b.colour))];
  const patterns = colours
    .map(
      (c, i) =>
        `<pattern id="s${i}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
        `<rect width="2" height="4" fill="${c}"/></pattern>`,
    )
    .join('');

  const grid = axis.years
    .map((y) => {
      const at = x(Date.UTC(y, 0, 1));
      return (
        `<line x1="${at}" y1="${TOP}" x2="${at}" y2="${bottom}" stroke="#eaecf0"/>` +
        `<text x="${at}" y="${bottom + 14}" font-size="9" fill="#667085" text-anchor="middle">${y}</text>`
      );
    })
    .join('');

  const rows = bars
    .map((b, i) => {
      const y = TOP + i * ROW;
      const start = x(b.start);
      const full = x(b.full);
      const end = x(b.end);
      const pattern = `url(#s${colours.indexOf(b.colour)})`;
      return (
        `<text x="0" y="${y + 14}" font-size="10" fill="#101828">${escape(clip(b.label, 26))}</text>` +
        `<rect x="${start}" y="${y + 6}" width="${Math.max(full - start, 0)}" height="9" fill="${b.colour}" rx="2"/>` +
        `<rect x="${full}" y="${y + 6}" width="${Math.max(end - full, 0)}" height="9" fill="${pattern}" stroke="${b.colour}" stroke-width="0.6" rx="2"/>`
      );
    })
    .join('');

  const today = x(axis.today);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; }
      svg { display: block; font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; }
    </style>
  </head>
  <body>
    <svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH * CHART_SCALE}" height="${height * CHART_SCALE}" viewBox="0 0 ${CHART_WIDTH} ${height}">
      <defs>${patterns}</defs>
      ${grid}
      ${rows}
      <line x1="${today}" y1="${TOP - 2}" x2="${today}" y2="${bottom + 2}" stroke="#101828" stroke-width="1.4"/>
    </svg>
  </body>
</html>`;
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
