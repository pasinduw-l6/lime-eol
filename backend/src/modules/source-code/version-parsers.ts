/** Node.js version from the first node image in a Dockerfile, with ARG defaults filled in. "10.15.3-alpine" → "10.15.3". */
export function nodeFromDockerfile(dockerfile: string): string | null {
  const args: Record<string, string> = {};
  for (const m of dockerfile.matchAll(/^\s*ARG\s+(\w+)\s*=\s*"?([^"\s]+)"?/gim)) args[m[1]] = m[2];
  for (const m of dockerfile.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)) {
    const image = m[1].replace(/\$\{?(\w+)\}?/g, (_, name: string) => args[name] ?? '');
    const tag = image.match(/(?:^|\/)node:([^\s@]+)/i)?.[1];
    if (tag) return versionOf(tag);
  }
  return null;
}

/** Angular version: the exact one from package-lock.json when there, otherwise @angular/core from package.json. */
export function angularFromPackage(packageJson: string | null, lockJson: string | null): string | null {
  if (lockJson) {
    try {
      const exact = JSON.parse(lockJson).packages?.['node_modules/@angular/core']?.version;
      if (exact) return versionOf(exact);
    } catch {
      // A broken lock file falls back to package.json.
    }
  }
  if (!packageJson) return null;
  try {
    const pkg = JSON.parse(packageJson);
    const range = pkg.dependencies?.['@angular/core'] ?? pkg.devDependencies?.['@angular/core'];
    return typeof range === 'string' ? versionOf(range) : null;
  } catch {
    return null;
  }
}

/** The leading version number of a tag or range: "^10.2.3" → "10.2.3", "20-alpine" → "20", "lts" → null. */
export function versionOf(value: string): string | null {
  return value.trim().match(/^[\^~>=v\s]*(\d+(?:\.\d+){0,2})/)?.[1] ?? null;
}
