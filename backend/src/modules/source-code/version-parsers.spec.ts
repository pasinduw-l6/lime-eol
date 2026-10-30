import { angularFromPackage, nodeFromDockerfile, versionOf } from './version-parsers';

describe('Node.js from a Dockerfile', () => {
  it('reads the tag of the node image', () => {
    expect(nodeFromDockerfile('FROM node:10.15.3-alpine\nWORKDIR /app')).toBe('10.15.3');
  });

  it('takes the node stage of a multi-stage build', () => {
    expect(nodeFromDockerfile('FROM node:20.11-alpine AS build\nRUN npm ci\nFROM nginx:1.27\nCOPY --from=build /app /usr/share/nginx/html')).toBe('20.11');
  });

  it('fills in ARG defaults, registries and --platform', () => {
    expect(nodeFromDockerfile('ARG NODE_VERSION=22.11.0\nFROM --platform=linux/amd64 public.ecr.aws/docker/library/node:${NODE_VERSION}-slim')).toBe('22.11.0');
  });

  it('says nothing when there is no node image', () => {
    expect(nodeFromDockerfile('FROM nginx:1.27-alpine')).toBeNull();
    expect(nodeFromDockerfile('FROM node:lts-alpine')).toBeNull();
  });
});

describe('Angular from package.json', () => {
  const pkg = JSON.stringify({ dependencies: { '@angular/core': '~10.2.3' } });

  it('reads @angular/core without the range sign', () => {
    expect(angularFromPackage(pkg, null)).toBe('10.2.3');
  });

  it('prefers the exact version from the lock file', () => {
    const lock = JSON.stringify({ packages: { 'node_modules/@angular/core': { version: '10.2.5' } } });
    expect(angularFromPackage(pkg, lock)).toBe('10.2.5');
  });

  it('says nothing for projects without Angular or a broken file', () => {
    expect(angularFromPackage(JSON.stringify({ dependencies: { react: '18.0.0' } }), null)).toBeNull();
    expect(angularFromPackage('{ not json', null)).toBeNull();
  });
});

describe('versionOf', () => {
  it.each([
    ['^16.1.0', '16.1.0'],
    ['>=18', '18'],
    ['v20.11.1', '20.11.1'],
    ['20-alpine', '20'],
    ['latest', null],
  ])('%p → %p', (input, out) => expect(versionOf(input)).toBe(out));
});
