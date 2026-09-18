import { DEPLOYMENTS as FLAGSHIP_DEPLOYMENTS, TOPOLOGIES as FLAGSHIP_TOPOLOGIES } from './mock-data';
import {
  Deployment,
  DeploymentComponent,
  Engineer,
  EnvTopology,
  EnvironmentName,
  Project,
} from './models';

/**
 * Projects, the engineers staffing them, and the Lime release each customer
 * runs. Eight here only to show the shape at scale — the UI filters and
 * searches rather than assuming a handful.
 */

export const ENGINEERS: Engineer[] = [
  { id: 'e1', name: 'Nadun Perera', initials: 'NP', role: 'Lead' },
  { id: 'e2', name: 'Ishara Fernando', initials: 'IF', role: 'Engineer' },
  { id: 'e3', name: 'Dilshan Silva', initials: 'DS', role: 'Engineer' },
  { id: 'e4', name: 'Tharindu Jayasuriya', initials: 'TJ', role: 'Lead' },
  { id: 'e5', name: 'Amaya Wickrama', initials: 'AW', role: 'Engineer' },
  { id: 'e6', name: 'Kasun Ratnayake', initials: 'KR', role: 'Engineer' },
  { id: 'e7', name: 'Hasini de Alwis', initials: 'HA', role: 'Lead' },
];

/**
 * What each Lime release ships with.
 *
 * This is why the Lime version a customer is on matters so much: a project on
 * 2025.4 inherits Node 25 and MongoDB 8.2.4, both already out of support,
 * while 2026.2 is clean. Adding a project picks up its release's stack.
 */
export const LIME_TEMPLATES: Record<string, { technology: string; version: string }[]> = {
  '2025.4': [
    { technology: 'MongoDB', version: '8.2.4' },
    { technology: 'Node.js', version: '25.9.0' },
    { technology: 'Angular', version: '20.3.31' },
    { technology: 'Kubernetes', version: '1.35.8' },
    { technology: 'RHEL', version: '9.6' },
    { technology: 'Apache Kafka', version: '3.8.1' },
    { technology: 'OpenSSL', version: '3.6.4' },
    { technology: 'Docker Engine', version: '28.5.2' },
  ],
  '2026.1': [
    { technology: 'MongoDB', version: '8.2.12' },
    { technology: 'Node.js', version: '24.21.0' },
    { technology: 'Angular', version: '20.3.31' },
    { technology: 'Kubernetes', version: '1.35.8' },
    { technology: 'RHEL', version: '9.8' },
    { technology: 'Apache Kafka', version: '3.8.1' },
    { technology: 'OpenSSL', version: '3.6.4' },
  ],
  '2026.2': [
    { technology: 'MongoDB', version: '8.3.11' },
    { technology: 'Node.js', version: '24.21.0' },
    { technology: 'Angular', version: '21.2.23' },
    { technology: 'Kubernetes', version: '1.35.8' },
    { technology: 'RHEL', version: '9.8' },
    { technology: 'OpenSSL', version: '3.5.8' },
    { technology: 'PostgreSQL', version: '16.15' },
  ],
};

export const LIME_VERSIONS = Object.keys(LIME_TEMPLATES).sort().reverse();

interface ProjectSeed extends Project {
  environments: EnvironmentName[];
  location: Deployment['location'];
  locationDetail: string;
}

const SEEDS: ProjectSeed[] = [
  {
    id: 'acme',
    name: 'Acme Bank — Core',
    customer: 'Acme Bank',
    code: 'ACME',
    limeVersion: '2026.1',
    status: 'ACTIVE',
    engineerIds: ['e1', 'e2'],
    startedAt: '2024-02-01',
    environments: ['PROD', 'UAT'],
    location: 'EC2',
    locationDetail: 'eu-west-1',
  },
  {
    id: 'nwnd',
    name: 'Northwind Insurance',
    customer: 'Northwind Insurance',
    code: 'NWND',
    limeVersion: '2026.1',
    status: 'ACTIVE',
    engineerIds: ['e3'],
    startedAt: '2023-09-15',
    environments: ['PROD', 'DEV'],
    location: 'CUSTOMER_SITE',
    locationDetail: 'Northwind DC, Colombo',
  },
  {
    id: 'vrtx',
    name: 'Vertex Logistics',
    customer: 'Vertex Logistics',
    code: 'VRTX',
    limeVersion: '2025.4',
    status: 'ACTIVE',
    engineerIds: ['e2', 'e4'],
    startedAt: '2023-04-20',
    environments: ['PROD', 'UAT'],
    location: 'EC2',
    locationDetail: 'ap-south-1',
    notes: 'Still on 2025.4 — upgrade blocked by a custom integration.',
  },
  {
    id: 'hrbr',
    name: 'Harbour Health',
    customer: 'Harbour Health',
    code: 'HRBR',
    limeVersion: '2026.2',
    status: 'ONBOARDING',
    engineerIds: ['e5'],
    startedAt: '2026-08-01',
    environments: ['DEV'],
    location: 'EC2',
    locationDetail: 'eu-central-1',
  },
  {
    id: 'mrdn',
    name: 'Meridian Retail',
    customer: 'Meridian Retail',
    code: 'MRDN',
    limeVersion: '2025.4',
    status: 'ACTIVE',
    engineerIds: ['e4', 'e6'],
    startedAt: '2022-11-10',
    environments: ['PROD', 'UAT', 'DEV'],
    location: 'CUSTOMER_SITE',
    locationDetail: 'Meridian DC, Kandy',
  },
  {
    id: 'stpl',
    name: 'Staple Utilities',
    customer: 'Staple Utilities',
    code: 'STPL',
    limeVersion: '2026.1',
    status: 'ACTIVE',
    engineerIds: ['e6'],
    startedAt: '2025-01-08',
    environments: ['PROD'],
    location: 'EC2',
    locationDetail: 'eu-west-1',
  },
  {
    id: 'altn',
    name: 'Altona Telecom',
    customer: 'Altona Telecom',
    code: 'ALTN',
    limeVersion: '2026.2',
    status: 'ACTIVE',
    engineerIds: ['e7', 'e1'],
    startedAt: '2026-03-30',
    environments: ['PROD', 'UAT'],
    location: 'EC2',
    locationDetail: 'me-south-1',
  },
  {
    id: 'kstl',
    name: 'Kestrel Freight',
    customer: 'Kestrel Freight',
    code: 'KSTL',
    limeVersion: '2025.4',
    status: 'PAUSED',
    engineerIds: ['e3'],
    startedAt: '2021-06-01',
    environments: ['PROD'],
    location: 'CUSTOMER_SITE',
    locationDetail: 'Kestrel DC, Galle',
    notes: 'Contract under renewal; environment frozen.',
  },
];

export const PROJECTS: Project[] = SEEDS.map(
  ({ environments, location, locationDetail, ...project }) => project,
);

/** Components a project inherits from its Lime release. */
export function componentsFor(limeVersion: string): DeploymentComponent[] {
  return (LIME_TEMPLATES[limeVersion] ?? []).map((c) => ({
    ...c,
    source: 'LIME_DEFAULT' as const,
  }));
}

export function deploymentId(projectId: string, env: EnvironmentName): string {
  return `${projectId}-${env.toLowerCase()}`;
}

export function buildDeployment(
  project: Project,
  env: EnvironmentName,
  location: Deployment['location'],
  locationDetail: string,
): Deployment {
  return {
    id: deploymentId(project.id, env),
    projectId: project.id,
    customer: project.customer,
    customerCode: project.code,
    name: `${project.customer} ${env}`,
    environment: env,
    location,
    locationDetail,
    limeVersion: project.limeVersion,
    owners: ['DevOps'],
    components: componentsFor(project.limeVersion),
  };
}

/** A two-tier starting topology, enough to be edited rather than authored. */
export function buildTopology(deployment: Deployment): EnvTopology {
  const stack = deployment.components.map((c) => ({
    technology: c.technology,
    version: c.version,
  }));
  const databases = ['MongoDB', 'PostgreSQL'];

  return {
    deploymentId: deployment.id,
    nodes: [
      {
        id: 'app',
        name: 'Lime application',
        role: 'application',
        host: `${deployment.customerCode.toLowerCase()}-app`,
        x: 60,
        y: 90,
        stack: stack.filter((s) => !databases.includes(s.technology)),
      },
      {
        id: 'data',
        name: 'Data tier',
        role: 'database',
        host: `${deployment.customerCode.toLowerCase()}-db`,
        x: 420,
        y: 90,
        stack: stack.filter((s) => databases.includes(s.technology)),
      },
    ],
    links: [{ from: 'app', to: 'data', label: 'data' }],
  };
}

/** The two flagship projects keep their hand-authored topologies. */
const GENERATED_DEPLOYMENTS: Deployment[] = SEEDS.filter(
  (s) => !['acme', 'nwnd'].includes(s.id),
).flatMap((seed) =>
  seed.environments.map((env) =>
    buildDeployment(seed, env, seed.location, seed.locationDetail),
  ),
);

export const ALL_DEPLOYMENTS: Deployment[] = [
  ...FLAGSHIP_DEPLOYMENTS,
  ...GENERATED_DEPLOYMENTS,
];

export const ALL_TOPOLOGIES: EnvTopology[] = [
  ...FLAGSHIP_TOPOLOGIES,
  ...GENERATED_DEPLOYMENTS.map(buildTopology),
];
