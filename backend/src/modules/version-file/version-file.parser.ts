import { parse } from 'yaml';

/**
 * Reads eol-versions.yml:
 *
 *   DBANK:            # project code
 *     PROD:           # DEV, UAT or PROD
 *       Node.js: 20.11.1
 *       Angular: 17.3.0
 *
 * Bad entries become warnings; the rest of the file still applies.
 */

export const FILE_ENVIRONMENTS = ['DEV', 'UAT', 'PROD'] as const;
export type FileEnvironment = (typeof FILE_ENVIRONMENTS)[number];

export interface VersionEntry {
  project: string;
  environment: FileEnvironment;
  technology: string;
  version: string;
}

export interface ParsedFile {
  entries: VersionEntry[];
  warnings: string[];
}

const VERSION = /^v?\d+(\.\d+){0,3}([.-][0-9A-Za-z.-]+)?$/;

export function parseVersionFile(text: string): ParsedFile {
  const warnings: string[] = [];
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (error) {
    return { entries: [], warnings: [`The file is not valid YAML: ${message(error)}`] };
  }
  if (doc === null || doc === undefined) return { entries: [], warnings: ['The file is empty.'] };
  if (!isMap(doc)) return { entries: [], warnings: ['The file must list project codes at the top level.'] };

  const entries: VersionEntry[] = [];
  for (const [project, envs] of Object.entries(doc)) {
    if (!isMap(envs)) {
      warnings.push(`${project}: list environments (DEV, UAT, PROD) under the project code.`);
      continue;
    }
    for (const [envName, techs] of Object.entries(envs)) {
      const environment = envName.toUpperCase() as FileEnvironment;
      if (!FILE_ENVIRONMENTS.includes(environment)) {
        warnings.push(`${project} · ${envName}: unknown environment. Use DEV, UAT or PROD.`);
        continue;
      }
      if (!isMap(techs)) {
        warnings.push(`${project} · ${environment}: list technologies and versions under the environment.`);
        continue;
      }
      for (const [technology, raw] of Object.entries(techs)) {
        const version = String(raw ?? '').trim().replace(/^v(?=\d)/, '');
        if (!VERSION.test(version)) {
          warnings.push(`${project} · ${environment} · ${technology}: "${raw}" is not a version number.`);
          continue;
        }
        entries.push({ project: project.trim(), environment, technology: technology.trim(), version });
      }
    }
  }
  return { entries, warnings };
}

/** Names people are likely to type, mapped to the registry name. */
const ALIASES: Record<string, string> = {
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  angular: 'Angular',
  '@angular/core': 'Angular',
};

export function registryName(typed: string, known: string[]): string | null {
  const exact = known.find((k) => k.toLowerCase() === typed.toLowerCase());
  if (exact) return exact;
  const alias = ALIASES[typed.toLowerCase()];
  return alias && known.includes(alias) ? alias : null;
}

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}
