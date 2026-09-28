
export type ComponentType =
  | 'DATABASE'
  | 'RUNTIME'
  | 'FRAMEWORK'
  | 'OS'
  | 'CONTAINER'
  | 'ORCHESTRATION'
  | 'MESSAGING'
  | 'LIBRARY'
  | 'OTHER';

export type EnvironmentName = 'DEV' | 'UAT' | 'PROD';
export type DeploymentLocation = 'EC2' | 'CUSTOMER_SITE';
export type EolSource = 'API' | 'MANUAL';

export type CycleRule = 'MAJOR' | 'MAJOR_MINOR';

export interface Technology {
  id: string;
  name: string;
  componentType: ComponentType;
  vendor: string | null;
  eolSlug: string | null;
  cycleRule: CycleRule;
  iconSlug: string | null;
  iconColour: string | null;
  notes: string | null;
}

export interface Cycle {
  id: string;
  technology: string;
  componentType: ComponentType;
  cycle: string;
  label: string;
  releaseDate: string | null;
  eolDate: string | null;
  activeSupportEnd: string | null;
  isLts: boolean;
  isMaintained: boolean;
  latestPatch: string | null;
  eolSource: EolSource;
  versions: string[];
}

export interface DeploymentComponent {
  technology: string;
  version: string;
  source: 'LIME_DEFAULT' | 'OVERRIDE';
}

export interface Engineer {
  id: string;
  name: string;
  initials: string;
  email: string;
  canEdit: boolean;
  role: 'Engineer' | 'Viewer';
}

export type ProjectStatus = 'ACTIVE' | 'ONBOARDING' | 'PAUSED';

export interface Project {
  id: string;
  name: string;
  customer: string;
  code: string;
  limeVersion: string;
  status: ProjectStatus;
  engineerIds: string[];
  startedAt: string;
  notes?: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  customer: string;
  customerCode: string;
  name: string;
  environment: EnvironmentName;
  location: DeploymentLocation;
  locationDetail: string;
  limeVersion: string | null;
  owners: string[];
  components: DeploymentComponent[];
}

export interface EnvNode {
  id: string;
  name: string;
  role: 'gateway' | 'application' | 'database' | 'messaging' | 'platform';
  host?: string;
  x: number;
  y: number;
  stack: { technology: string; version: string }[];
}

export interface EnvLink {
  from: string;
  to: string;
  label?: string;
}

export interface EnvTopology {
  deploymentId: string;
  nodes: EnvNode[];
  links: EnvLink[];
}

export interface Revision {
  id: string;
  deploymentId: string;
  number: number;
  message: string;
  author: string;
  createdAt: string;
  content: EnvTopology;
}

export interface UpgradeAction {
  id: string;
  technology: string;
  cycle: string;
  targetVersion: string | null;
  status: 'NOT_STARTED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';
  plannedDate: string | null;
  completedDate: string | null;
  assignee: string | null;
  team: string | null;
  jiraKey: string | null;
  deploymentIds: string[];
}
