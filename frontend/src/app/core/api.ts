import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { RoleName } from './permissions';


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
  customerId: string;
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
  scope: ComponentScope;
  vendor: string | null;
  eolSlug: string | null;
  cycleRule: string;
  iconSlug: string | null;
  iconColour: string | null;
  notes: string | null;
  cycles: ApiCycle[];
}

export type ComponentScope = 'INFRASTRUCTURE' | 'APPLICATION';
export type CommercialModel = 'SUBSCRIPTION' | 'LICENSE';
export type Decision = 'UPGRADE' | 'EXTENDED_SUPPORT' | 'ACCEPT_RISK' | 'COMMERCIAL_QUOTE';

export interface ApiCustomer {
  id: string;
  name: string;
  code: string | null;
  contact: string | null;
  notes: string | null;
  commercialModel: CommercialModel | null;
  contractStart: string | null;
  contractEnd: string | null;
  projectCount: number;
}

export interface ApiTeam {
  id: string;
  name: string;
  email: string | null;
  archivedAt: string | null;
  members: { id: string; name: string }[];
  environments: { id: string; name: string; isPrimary: boolean }[];
}

export interface ApiLimeRelease {
  id: string;
  version: string;
  releaseDate: string | null;
  supportEnd: string | null;
  notes: string | null;
  environments: number;
  projects: string[];
  compatibility: { techVersionId: string; technology: string; version: string }[];
}

export interface ApiCompatibilityOption {
  technology: string;
  versions: { id: string; version: string; cycle: string }[];
}

export interface ApiAuditRow {
  id: string;
  at: string;
  user: { id: string; name: string } | null;
  entity: string;
  entityId: string | null;
  action: string;
  data: unknown;
}

export interface ApiAuditPage {
  total: number;
  entities: string[];
  rows: ApiAuditRow[];
}

export interface CustomerInput {
  name?: string;
  code?: string | null;
  contact?: string | null;
  notes?: string | null;
  commercialModel?: CommercialModel | null;
  contractStart?: string | null;
  contractEnd?: string | null;
}

export interface ApiArchived {
  id: string;
  name: string;
  code?: string;
  customer?: string;
  componentType?: string;
  archivedAt: string | null;
}

export interface CycleInput {
  cycle: string;
  label?: string | null;
  releaseDate?: string | null;
  activeSupportEnd?: string | null;
  eolDate?: string | null;
  isLts?: boolean;
  latestPatch?: string | null;
  versions?: string[];
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
  role: RoleName;
  isActive: boolean;
  teams: { id: string; name: string }[];
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
  customerNotifiedAt: string | null;
  remarks: string | null;
  decision: Decision | null;
  assessment: string | null;
  riskApprover: string | null;
  riskExpiresAt: string | null;
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
  updateProject(
    projectId: string,
    input: {
      name?: string;
      limeVersion?: string;
      status?: string;
      startedAt?: string;
      notes?: string;
    },
  ) {
    return this.http.patch<ApiProject>(
      `/api/v1/projects/${encodeURIComponent(projectId)}`,
      input,
    );
  }

  setEngineers(projectId: string, engineerIds: string[], leadId?: string) {
    return this.http.patch<ApiProject>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/engineers`,
      { engineerIds, leadId },
    );
  }

  archiveProject(projectId: string) {
    return this.http.delete<void>(`/api/v1/projects/${encodeURIComponent(projectId)}`);
  }

  addEnvironment(
    projectId: string,
    body: { environment: string; location: string; locationDetail?: string; copyFrom?: string },
  ) {
    return this.http.post<ApiProject>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/environments`,
      body,
    );
  }

  archiveEnvironment(deploymentId: string) {
    return this.http.delete<void>(`/api/v1/deployments/${deploymentId}`);
  }

  updateTechnology(
    id: string,
    body: {
      name?: string;
      componentType?: string;
      scope?: ComponentScope;
      vendor?: string;
      cycleRule?: string;
      notes?: string;
    },
  ) {
    return this.http.patch<ApiTechnology>(`/api/v1/technologies/${id}`, body);
  }

  archiveTechnology(id: string) {
    return this.http.delete<void>(`/api/v1/technologies/${id}`);
  }

  createCycle(technologyId: string, body: CycleInput) {
    return this.http.post<ApiTechnology>(`/api/v1/technologies/${technologyId}/cycles`, body);
  }

  updateCycle(cycleId: string, body: Partial<CycleInput>) {
    return this.http.patch<ApiTechnology>(`/api/v1/technologies/cycles/${cycleId}`, body);
  }

  deleteCycle(cycleId: string) {
    return this.http.delete<void>(`/api/v1/technologies/cycles/${cycleId}`);
  }

  updateCustomer(
    id: string,
    body: {
      contact?: string | null;
      notes?: string | null;
      commercialModel?: CommercialModel | null;
      contractStart?: string | null;
      contractEnd?: string | null;
    },
  ) {
    return this.http.patch<ApiCustomer>(`/api/v1/customers/${id}`, body);
  }

  createCustomer(body: CustomerInput & { name: string }) {
    return this.http.post<ApiCustomer>('/api/v1/customers', body);
  }

  editCustomer(id: string, body: CustomerInput) {
    return this.http.patch<ApiCustomer>(`/api/v1/customers/${id}`, body);
  }

  archiveCustomer(id: string) {
    return this.http.delete<void>(`/api/v1/customers/${id}`);
  }

  restoreCustomer(id: string) {
    return this.http.post<ApiCustomer>(`/api/v1/customers/${id}/restore`, {});
  }

  archivedCustomers() {
    return this.http.get<ApiCustomer[]>('/api/v1/customers/archived');
  }

  limeReleases() {
    return this.http.get<ApiLimeRelease[]>('/api/v1/lime-releases');
  }

  compatibilityOptions() {
    return this.http.get<ApiCompatibilityOption[]>('/api/v1/lime-releases/options');
  }

  createLimeRelease(body: { version: string; releaseDate?: string | null; supportEnd?: string | null; notes?: string | null }) {
    return this.http.post<ApiLimeRelease>('/api/v1/lime-releases', body);
  }

  updateLimeRelease(
    id: string,
    body: { version?: string; releaseDate?: string | null; supportEnd?: string | null; notes?: string | null },
  ) {
    return this.http.patch<ApiLimeRelease>(`/api/v1/lime-releases/${id}`, body);
  }

  setLimeCompatibility(id: string, techVersionIds: string[]) {
    return this.http.put<ApiLimeRelease>(`/api/v1/lime-releases/${id}/compatibility`, { techVersionIds });
  }

  deleteLimeRelease(id: string) {
    return this.http.delete<void>(`/api/v1/lime-releases/${id}`);
  }

  audit(filters: { entity?: string; userId?: string; from?: string; to?: string; limit?: number; offset?: number }) {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params[key] = String(value);
    }
    return this.http.get<ApiAuditPage>('/api/v1/audit', { params });
  }

  allUsers() {
    return this.http.get<ApiUser[]>('/api/v1/users?all=true');
  }

  inviteUser(body: { email: string; displayName?: string; role: RoleName }) {
    return this.http.post<ApiUser>('/api/v1/users', body);
  }

  updateUser(id: string, body: { displayName?: string; role?: RoleName; isActive?: boolean }) {
    return this.http.patch<ApiUser>(`/api/v1/users/${id}`, body);
  }

  readonly teamsResource = httpResource<ApiTeam[]>(() => '/api/v1/teams');
  readonly teams = computed(() => this.teamsResource.value() ?? []);

  archivedTeams() {
    return this.http.get<ApiTeam[]>('/api/v1/teams/archived');
  }

  createTeam(body: { name: string; email?: string | null; memberIds?: string[] }) {
    return this.http.post<ApiTeam>('/api/v1/teams', body);
  }

  updateTeam(id: string, body: { name?: string; email?: string | null; memberIds?: string[] }) {
    return this.http.patch<ApiTeam>(`/api/v1/teams/${id}`, body);
  }

  archiveTeam(id: string) {
    return this.http.delete<void>(`/api/v1/teams/${id}`);
  }

  restoreTeam(id: string) {
    return this.http.post<ApiTeam>(`/api/v1/teams/${id}/restore`, {});
  }

  setOwners(deploymentId: string, teamIds: string[]) {
    return this.http.patch<{ id: string; owners: string[] }>(
      `/api/v1/deployments/${deploymentId}/owners`,
      { teamIds },
    );
  }

  archivedProjects() {
    return this.http.get<ApiArchived[]>('/api/v1/projects/archived');
  }

  restoreProject(id: string) {
    return this.http.post<ApiProject>(`/api/v1/projects/${id}/restore`, {});
  }

  archivedTechnologies() {
    return this.http.get<ApiArchived[]>('/api/v1/technologies/archived');
  }

  restoreTechnology(id: string) {
    return this.http.post<ApiTechnology>(`/api/v1/technologies/${id}/restore`, {});
  }

  readonly customersResource = httpResource<ApiCustomer[]>(() => '/api/v1/customers');
  readonly customers = computed(() => this.customersResource.value() ?? []);

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
    this.customersResource.reload();
    this.teamsResource.reload();
    this.technologiesResource.reload();
    this.usersResource.reload();
    this.actionsResource.reload();
    this.catalogueResource.reload();
  }
}
