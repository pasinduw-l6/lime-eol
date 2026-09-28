import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';


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
  iconSlug: string | null;
  iconColour: string | null;
  notes: string | null;
  cycles: ApiCycle[];
}

export interface ApiCatalogueProduct {
  slug: string;
  label: string;
  category: string;
  tags: string[];
  aliases: string[];
  iconSlug: string | null;
  iconColour: string | null;
  suggestedType: string;
  registeredAs: string | null;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  canEdit: boolean;
  projectCount: number;
  lastLoginAt: string | null;
}

export interface ApiNotificationStatus {
  enabled: boolean;
  dryRun: boolean;
  configured: boolean;
  channel: string;
  cron: string;
}

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

export interface ApiActionEnvironment {
  deploymentId: string;
  project: string;
  projectId: string | null;
  environment: 'DEV' | 'UAT' | 'PROD';
  completedAt: string | null;
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
  derivedStatus: string;
  plannedDate: string | null;
  completedDate: string | null;
  assignee: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  jiraKey: string | null;
  jiraStatusCategory: JiraStatusCategory | null;
  jiraSubtaskDone: number | null;
  jiraSubtaskTotal: number | null;
  customerComm: 'NOT_REQUIRED' | 'PENDING' | 'SENT' | 'ACKNOWLEDGED';
  customerCommNotes: string | null;
  remarks: string | null;
  environments: ApiActionEnvironment[];
  progress: { done: number; total: number };
  unverifiedCompletion: boolean;
  planTooLate: boolean;
  createdAt: string;
}

export type JiraStatusCategory = 'to-do' | 'in-progress' | 'done' | 'unknown';

export interface ApiJiraSubtask {
  key: string;
  summary: string;
  status: string;
  statusCategory: JiraStatusCategory;
  assignee: string | null;
  url: string;
}

export interface ApiJiraLink {
  linked: boolean;
  key: string | null;
  url: string | null;
  status: string | null;
  statusCategory: JiraStatusCategory | null;
  assignee: string | null;
  done: number;
  total: number;
  syncedAt: string | null;
  syncError: string | null;
  subtasks: ApiJiraSubtask[];
}

export interface ApiJiraAssignee {
  id: string;
  name: string;
}

export interface ApiJiraStatus {
  tracker: string;
  configured: boolean;
  reachable: boolean;
  detail: string;
  demo: boolean;
  missing: string[];
  projectKey: string | null;
  baseUrl: string | null;
  cron: string;
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

export interface ApiActivity {
  id: string;
  kind: 'DONE';
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
  registered: boolean;
  versions: string[];
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

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

  readonly catalogueResource = httpResource<ApiCatalogueProduct[]>(
    () => '/api/v1/technologies/catalogue',
  );

  readonly catalogue = computed(() => this.catalogueResource.value() ?? []);

  activity(projectId: string) {
    return this.http.get<ApiActivity[]>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/activity`,
    );
  }

  history(deploymentId: string) {
    return this.http.get<ApiChange[]>(`/api/v1/deployments/${deploymentId}/history`);
  }

  verifyHistory(deploymentId: string) {
    return this.http.get<ApiVerification>(
      `/api/v1/deployments/${deploymentId}/history/verify`,
    );
  }

  historyCsvUrl(deploymentId: string): string {
    return `/api/v1/deployments/${deploymentId}/history.csv`;
  }

  versionsFor(technology: string, currentVersion?: string) {
    const current = currentVersion
      ? `&currentVersion=${encodeURIComponent(currentVersion)}`
      : '';
    return this.http.get<ApiVersionOption[]>(
      `/api/v1/deployments/versions/available?technology=${encodeURIComponent(technology)}${current}`,
    );
  }
  setEngineers(projectId: string, engineerIds: string[], leadId?: string) {
    return this.http.patch<ApiProject>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/engineers`,
      { engineerIds, leadId },
    );
  }

  readonly projectsResource = httpResource<ApiProject[]>(() => '/api/v1/projects');
  readonly usersResource = httpResource<ApiUser[]>(() => '/api/v1/users');


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

  completeActionEnvironment(id: string, deploymentId: string) {
    return this.http.post<ApiUpgradeAction>(
      `/api/v1/upgrade-actions/${id}/environments/complete`,
      { deploymentId },
    );
  }

  deleteAction(id: string) {
    return this.http.delete<void>(`/api/v1/upgrade-actions/${id}`);
  }

  jiraLink(actionId: string) {
    return this.http.get<ApiJiraLink>(`/api/v1/upgrade-actions/${actionId}/jira`);
  }

  linkJiraIssue(actionId: string, issueKey: string) {
    return this.http.post<ApiJiraLink>(
      `/api/v1/upgrade-actions/${actionId}/jira/link`,
      { issueKey },
    );
  }

  syncJiraIssue(actionId: string) {
    return this.http.post<ApiJiraLink>(
      `/api/v1/upgrade-actions/${actionId}/jira/sync`,
      {},
    );
  }

  unlinkJiraIssue(actionId: string) {
    return this.http.delete<ApiJiraLink>(
      `/api/v1/upgrade-actions/${actionId}/jira/link`,
    );
  }

  jiraAssignees(actionId: string) {
    return this.http.get<ApiJiraAssignee[]>(
      `/api/v1/upgrade-actions/${actionId}/jira/assignees`,
    );
  }

  addJiraSubtask(
    actionId: string,
    body: {
      summary: string;
      description?: string;
      dueDate?: string;
      assigneeId?: string;
    },
  ) {
    return this.http.post<ApiJiraLink>(
      `/api/v1/upgrade-actions/${actionId}/jira/subtasks`,
      body,
    );
  }

  readonly jiraStatusResource = httpResource<ApiJiraStatus>(
    () => '/api/v1/integrations/jira/status',
  );

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
    this.catalogueResource.reload();
  }
}
