export function parseDuration(value: string | undefined | null): number | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 3600);

  const units: Record<string, number> = { w: 5 * 8 * 3600, d: 8 * 3600, h: 3600, m: 60 };
  let total = 0;
  let matched = '';
  for (const part of text.matchAll(/(\d+(?:\.\d+)?)\s*([wdhm])/g)) {
    total += Number(part[1]) * units[part[2]!]!;
    matched += part[0];
  }
  if (!total || matched.replace(/\s/g, '') !== text.replace(/\s/g, '')) return null;
  return Math.round(total);
}
