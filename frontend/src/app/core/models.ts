/**
 * Mirrors the backend DTOs so the mock layer can be swapped for generated
 * types from /api/docs-json without reshaping any component.
 */

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

/** One support cycle — where all lifecycle dates live (see db-design-notes). */
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

/** A DevOps engineer. Projects are staffed, and staffing drives the inbox. */
export interface Engineer {
  id: string;
  name: string;
  initials: string;
  role: 'Lead' | 'Engineer';
}

export type ProjectStatus = 'ACTIVE' | 'ONBOARDING' | 'PAUSED';

/**
 * One customer's Lime installation — the unit engineers actually work in.
 *
 * A customer may run more than one (a second brand, a separate region), so
 * this is deliberately not the same record as the customer.
 */
export interface Project {
  id: string;
  name: string;
  customer: string;
  code: string;
  /** Which Lime release this customer is on — differs per project. */
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

/** One machine or service in an environment. */
export interface EnvNode {
  id: string;
  name: string;
  role: 'gateway' | 'application' | 'database' | 'messaging' | 'platform';
  host?: string;
  /** Position on the canvas, kept in the JSON so an arrangement survives. */
  x: number;
  y: number;
  stack: { technology: string; version: string }[];
}

export interface EnvLink {
  from: string;
  to: string;
  label?: string;
}

/**
 * The editable unit: one customer environment as data.
 * This is what a DevOps engineer edits, either as JSON or on the canvas.
 */
export interface EnvTopology {
  deploymentId: string;
  nodes: EnvNode[];
  links: EnvLink[];
}

export interface UpgradeAction {
  id: string;
  technology: string;
  cycle: string;
  targetVersion: string | null;
  status: 'NOT_STARTED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';
  plannedDate: string | null;
  assignee: string | null;
  team: string | null;
  jiraKey: string | null;
  deploymentIds: string[];
}
