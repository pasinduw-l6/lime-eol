import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';

/**
 * The API, as the UI sees it.
 *
 * These shapes are what /api/v1/projects and /api/v1/technologies return; the
 * backend resolves lifecycle state server-side, so nothing here recomputes
 * what the database already knows.
 */

export interface ApiComponent {
  technology: string;
  componentType: string;
  version: string;
  cycle: string;
  eolDate: string | null;
  activeSupportEnd: string | null;
  latestPatch: string | null;
  daysToEol: number | null;
  status: 'EOL' | 'NEAR' | 'SUPPORTED' | 'UNKNOWN';
  eolSource: 'API' | 'MANUAL';
}

export interface ApiEnvironment {
  id: string;
  environment: 'DEV' | 'UAT' | 'PROD';
  location: string;
  locationDetail: string | null;
  owners: string[];
  components: ApiComponent[];
}

export interface ApiEngineer {
  id: string;
  name: string;
  initials: string;
  isLead: boolean;
}

export interface ApiProject {
  id: string;
  name: string;
  customer: string;
  code: string;
  limeVersion: string | null;
  status: 'ACTIVE' | 'ONBOARDING' | 'PAUSED';
  startedAt: string | null;
  engineers: ApiEngineer[];
  environments: ApiEnvironment[];
  risk: { eol: number; near: number };
}

export interface ApiCycle {
  id: string;
  cycle: string;
  label: string | null;
  releaseDate: string | null;
  eolDate: string | null;
  activeSupportEnd: string | null;
  isLts: boolean;
  isMaintained: boolean;
  latestPatch: string | null;
  eolSource: 'API' | 'MANUAL';
  notes: string | null;
  daysToEol: number | null;
  versions: string[];
}

export interface ApiTechnology {
  id: string;
  name: string;
  componentType: string;
  vendor: string | null;
  eolSlug: string | null;
  cycleRule: string;
  /** Simple Icons slug and brand colour, resolved when it was registered. */
  iconSlug: string | null;
  iconColour: string | null;
  notes: string | null;
  cycles: ApiCycle[];
}

/**
 * One product endoflife.date publishes.
 *
 * The registry can only hold these: a technology invented locally would have no
 * published lifecycle dates, which is the blind spot this tool exists to close.
 */
export interface ApiCatalogueProduct {
  slug: string;
  label: string;
  category: string;
  tags: string[];
  aliases: string[];
  iconSlug: string | null;
  iconColour: string | null;
  suggestedType: string;
  /** The local name it is already registered under, or null. */
  registeredAs: string | null;
}

/** Someone who can be staffed on a project. */
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  /** False for viewers, who can look but not record. */
  canEdit: boolean;
  projectCount: number;
  lastLoginAt: string | null;
}

/** Whether anything could actually be delivered. Never carries the webhook URL. */
export interface ApiNotificationStatus {
  enabled: boolean;
  dryRun: boolean;
  configured: boolean;
  channel: string;
  cron: string;
}

/** One send attempt, successful or not. */
export interface ApiNotificationLog {
  id: string;
  at: string;
  technology: string;
  cycle: string;
  threshold: number;
  recipient: string;
  channel: 'TEAMS' | 'EMAIL';
  success: boolean;
  error: string | null;
}

/** One environment an action covers, with whether the estate agrees it moved. */
export interface ApiActionEnvironment {
  deploymentId: string;
  project: string;
  projectId: string | null;
  environment: 'DEV' | 'UAT' | 'PROD';
  completedAt: string | null;
  /** A recorded change confirms this environment is on the new version. */
  verified: boolean;
}

export interface ApiUpgradeAction {
  id: string;
  technology: string;
  technologyCycleId: string;
  cycle: string;
  eolDate: string | null;
  daysToEol: number | null;
  targetVersion: string | null;
  status: string;
  /** Computed from progress and dates — OVERDUE and IN_PROGRESS are facts. */
  derivedStatus: string;
  plannedDate: string | null;
  completedDate: string | null;
  assignee: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  jiraKey: string | null;
  customerComm: 'NOT_REQUIRED' | 'PENDING' | 'SENT' | 'ACKNOWLEDGED';
  customerCommNotes: string | null;
  remarks: string | null;
  environments: ApiActionEnvironment[];
  progress: { done: number; total: number };
  /** Marked complete with no recorded change behind it. */
  unverifiedCompletion: boolean;
  /** The plan finishes after support ends. */
  planTooLate: boolean;
  createdAt: string;
}

/** One item on an upgrade's to-do list. */
export interface ApiActionStep {
  id: string;
  title: string;
  position: number;
  /** What it was expected to take, in minutes. */
  estimateMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  note: string | null;
  /** Measured from start to completion — never typed in. */
  actualMinutes: number | null;
  inProgress: boolean;
  /** The one to pick up next. */
  isNext: boolean;
}

export interface ApiVerification {
  intact: boolean;
  entries: number;
  brokenAt: number[];
  checkedAt: string;
}

export interface ApiChange {
  id: string;
  sequence: number;
  reason: string;
  ticketRef: string | null;
  evidenceUrl: string | null;
  correctsId: string | null;
  hash: string;
  technology: string;
  fromVersion: string | null;
  toVersion: string | null;
  changeType: 'INSTALL' | 'UPGRADE' | 'DOWNGRADE' | 'REMOVE';
  effectiveAt: string;
  recordedAt: string;
  recordedBy: string | null;
  note: string | null;
}

/**
 * One thing that happened on a project, from any of its environments.
 *
 * The backend flattens every environment's history into one stream so the
 * calendar does not have to fan out a request per environment and interleave
 * the results itself.
 */
export interface ApiActivity {
  id: string;
  kind: 'DONE';
  /** The day it took effect, which is what the agenda sorts by. */
  date: string;
  recordedAt: string;
  technology: string;
  fromVersion: string | null;
  toVersion: string | null;
  changeType: 'INSTALL' | 'UPGRADE' | 'DOWNGRADE' | 'REMOVE';
  reason: string;
  ticketRef: string | null;
  evidenceUrl: string | null;
  note: string | null;
  recordedBy: string | null;
  environment: 'DEV' | 'UAT' | 'PROD';
}

export interface ApiVersionOption {
  cycle: string;
  eolDate: string | null;
  /** False when the cycle comes from the source but is not in our registry. */
  registered: boolean;
  versions: string[];
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  /** Records the version an environment now runs, and the change itself. */
  changeComponent(
    deploymentId: string,
    body: {
      technology: string;
      toVersion: string;
      effectiveAt?: string;
      note?: string;
      reason?: string;
      ticketRef?: string;
      evidenceUrl?: string;
      correctsId?: string;
    },
  ) {
    return this.http.patch<ApiChange>(
      `/api/v1/deployments/${deploymentId}/components`,
      body,
    );
  }

  /** Creates a project, its environments and what each of them runs. */
  createProject(body: {
    name: string;
    customer: string;
    code: string;
    status?: string;
    limeVersion?: string;
    startedAt?: string;
    engineerIds?: string[];
    environments: {
      environment: string;
      location: string;
      locationDetail?: string;
    }[];
    stack: { technology: string; version: string }[];
  }) {
    return this.http.post<ApiProject>('/api/v1/projects', body);
  }

  /**
   * Registers a catalogue product. Name, type, cycle rule and logo come from
   * the product; every published cycle is imported in the same call, so it is
   * deployable immediately.
   */
  createTechnology(body: {
    slug: string;
    name?: string;
    componentType?: string;
    vendor?: string;
    cycleRule?: string;
    notes?: string;
  }) {
    return this.http.post<ApiTechnology>('/api/v1/technologies', body);
  }

  /**
   * The whole endoflife.date catalogue, loaded once and filtered in the browser.
   *
   * A few hundred rows, so a request per keystroke would be wasteful — and the
   * list is the same for everyone, which makes it worth caching for the session.
   */
  readonly catalogueResource = httpResource<ApiCatalogueProduct[]>(
    () => '/api/v1/technologies/catalogue',
  );

  readonly catalogue = computed(() => this.catalogueResource.value() ?? []);

  /** Every recorded change across a project, newest first. Accepts id or code. */
  activity(projectId: string) {
    return this.http.get<ApiActivity[]>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/activity`,
    );
  }

  history(deploymentId: string) {
    return this.http.get<ApiChange[]>(`/api/v1/deployments/${deploymentId}/history`);
  }

  /** Recomputes the hash chain, so the UI can say whether it is intact. */
  verifyHistory(deploymentId: string) {
    return this.http.get<ApiVerification>(
      `/api/v1/deployments/${deploymentId}/history/verify`,
    );
  }

  historyCsvUrl(deploymentId: string): string {
    return `/api/v1/deployments/${deploymentId}/history.csv`;
  }

  /** Upgrade targets: versions newer than the one running, grouped by cycle. */
  versionsFor(technology: string, currentVersion?: string) {
    const current = currentVersion
      ? `&currentVersion=${encodeURIComponent(currentVersion)}`
      : '';
    return this.http.get<ApiVersionOption[]>(
      `/api/v1/deployments/versions/available?technology=${encodeURIComponent(technology)}${current}`,
    );
  }
  /** Replaces who is staffed on a project, as the complete list. */
  setEngineers(projectId: string, engineerIds: string[], leadId?: string) {
    return this.http.patch<ApiProject>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/engineers`,
      { engineerIds, leadId },
    );
  }

  readonly projectsResource = httpResource<ApiProject[]>(() => '/api/v1/projects');
  readonly usersResource = httpResource<ApiUser[]>(() => '/api/v1/users');

  // ---- upgrade actions ------------------------------------------------------

  readonly actionsResource = httpResource<ApiUpgradeAction[]>(
    () => '/api/v1/upgrade-actions',
  );

  readonly actions = computed(() => this.actionsResource.value() ?? []);

  createAction(body: Record<string, unknown>) {
    return this.http.post<ApiUpgradeAction>('/api/v1/upgrade-actions', body);
  }

  updateAction(id: string, body: Record<string, unknown>) {
    return this.http.patch<ApiUpgradeAction>(`/api/v1/upgrade-actions/${id}`, body);
  }

  /** Marks one environment done; the action completes once all of them are. */
  completeActionEnvironment(id: string, deploymentId: string) {
    return this.http.post<ApiUpgradeAction>(
      `/api/v1/upgrade-actions/${id}/environments/complete`,
      { deploymentId },
    );
  }

  deleteAction(id: string) {
    return this.http.delete<void>(`/api/v1/upgrade-actions/${id}`);
  }

  // Every step call returns the whole list back, so the caller never has to
  // merge one changed row into what it already had.
  actionSteps(id: string) {
    return this.http.get<ApiActionStep[]>(`/api/v1/upgrade-actions/${id}/steps`);
  }

  addActionStep(id: string, body: { title: string; estimateMinutes?: number }) {
    return this.http.post<ApiActionStep[]>(
      `/api/v1/upgrade-actions/${id}/steps`,
      body,
    );
  }

  startActionStep(id: string, stepId: string) {
    return this.http.post<ApiActionStep[]>(
      `/api/v1/upgrade-actions/${id}/steps/${stepId}/start`,
      {},
    );
  }

  completeActionStep(id: string, stepId: string) {
    return this.http.post<ApiActionStep[]>(
      `/api/v1/upgrade-actions/${id}/steps/${stepId}/complete`,
      {},
    );
  }

  reopenActionStep(id: string, stepId: string) {
    return this.http.post<ApiActionStep[]>(
      `/api/v1/upgrade-actions/${id}/steps/${stepId}/reopen`,
      {},
    );
  }

  removeActionStep(id: string, stepId: string) {
    return this.http.delete<ApiActionStep[]>(
      `/api/v1/upgrade-actions/${id}/steps/${stepId}`,
    );
  }

  readonly notificationStatusResource = httpResource<ApiNotificationStatus>(
    () => '/api/v1/notifications/status',
  );
  readonly notificationLogResource = httpResource<ApiNotificationLog[]>(
    () => '/api/v1/notifications/log?limit=50',
  );

  readonly notificationStatus = computed(() => this.notificationStatusResource.value());
  readonly notificationLog = computed(() => this.notificationLogResource.value() ?? []);
  readonly users = computed(() => this.usersResource.value() ?? []);
  readonly technologiesResource = httpResource<ApiTechnology[]>(
    () => '/api/v1/technologies',
  );

  readonly projects = computed(() => this.projectsResource.value() ?? []);
  readonly technologies = computed(() => this.technologiesResource.value() ?? []);

  readonly isLoading = computed(
    () => this.projectsResource.isLoading() || this.technologiesResource.isLoading(),
  );

  readonly error = computed(
    () => this.projectsResource.error() ?? this.technologiesResource.error() ?? null,
  );

  reload(): void {
    this.projectsResource.reload();
    this.technologiesResource.reload();
    this.usersResource.reload();
    this.actionsResource.reload();
    // The catalogue's "already registered" marks go stale on every add.
    this.catalogueResource.reload();
  }
}
