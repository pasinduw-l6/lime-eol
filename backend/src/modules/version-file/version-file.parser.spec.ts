import { parseVersionFile, registryName } from './version-file.parser';

describe('eol-versions.yml', () => {
  it('reads project, environment, technology and version', () => {
    const { entries, warnings } = parseVersionFile(`
DBANK:
  PROD:
    Node.js: 20.11.1
    Angular: 17.3.0
  dev:
    Node.js: v22.11.0
`);
    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { project: 'DBANK', environment: 'PROD', technology: 'Node.js', version: '20.11.1' },
      { project: 'DBANK', environment: 'PROD', technology: 'Angular', version: '17.3.0' },
      { project: 'DBANK', environment: 'DEV', technology: 'Node.js', version: '22.11.0' },
    ]);
  });

  it('keeps going past bad entries and says what was wrong', () => {
    const { entries, warnings } = parseVersionFile(`
DBANK:
  STAGING:
    Node.js: 20
  PROD:
    Angular: latest
    Node.js: 20.11
`);
    expect(entries.map((e) => `${e.technology} ${e.version}`)).toEqual(['Node.js 20.11']);
    expect(warnings).toEqual([
      'DBANK · STAGING: unknown environment. Use DEV, UAT or PROD.',
      'DBANK · PROD · Angular: "latest" is not a version number.',
    ]);
  });

  it('reports a broken file instead of throwing', () => {
    expect(parseVersionFile('DBANK: [').warnings[0]).toMatch(/not valid YAML/);
    expect(parseVersionFile('').warnings).toEqual(['The file is empty.']);
  });

  it('matches technology names loosely to the registry', () => {
    const known = ['Node.js', 'Angular', 'MongoDB'];
    expect(registryName('nodejs', known)).toBe('Node.js');
    expect(registryName('mongodb', known)).toBe('MongoDB');
    expect(registryName('@angular/core', known)).toBe('Angular');
    expect(registryName('Python', known)).toBeNull();
  });
});
