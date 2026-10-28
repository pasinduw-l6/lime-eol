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
  jiraIntegrationId: string | null;
  jiraProjectKey: string | null;
  teamsIntegrationId: string | null;
  access?: 'VIEW' | 'EDIT' | null;
  engineers: ApiEngineer[];
  environments: ApiEnvironment[];
  risk: { eol: number; near: number };
}

export type IntegrationKind = 'JIRA' | 'TEAMS';

export interface ApiIntegration {
  id: string;
  kind: IntegrationKind;
  name: string;
  source: 'env' | 'ui';
  enabled: boolean;
  baseUrl: string | null;
  email: string | null;
  projectKey: string | null;
  tokenType: 'scoped' | 'classic' | null;
  secretHint: string | null;
  lastCheckedAt: string | null;
  lastOk: boolean | null;
  lastDetail: string | null;
  projects: number;
  /** Used by projects that picked none. Exactly one per kind; the .env one when none is chosen. */
  isDefault: boolean;
  /** Projects that picked none and so use this default. */
  viaDefault: number;
}

export interface ApiIntegrationOption {
  id: string;
  kind: IntegrationKind;
  name: string;
  projectKey: string | null;
}

export interface IntegrationInput {
  name?: string;
  baseUrl?: string;
  email?: string;
  projectKey?: string;
  tokenType?: 'scoped' | 'classic';
  secret?: string;
  enabled?: boolean;
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
export type Decision = 'UPGRADE' | 'EXTENDED_SUPPORT' | 'ACCEPT_RISK' | 'COMMERCIAL_QUOTE';

export interface ApiCustomer {
  id: string;
  name: string;
  code: string | null;
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
  roleName: string;
  isActive: boolean;
  teams: { id: string; name: string }[];
  canEdit: boolean;
  projectCount: number;
  allProjects: AccessLevel | null;
  accessCount: number;
  lastLoginAt: string | null;
}

export interface ApiRole {
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  pages: string[];
  builtIn: boolean;
  editable: boolean;
  users: number;
}

export interface ApiRoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
  pages: string[];
}

export type AccessLevel = 'VIEW' | 'EDIT';

export interface ApiAccessMatrix {
  projects: { id: string; name: string; code: string; customerId: string; customer: string }[];
  users: {
    id: string;
    name: string;
    email: string;
    role: RoleName;
    roleName: string;
    canEdit: boolean;
    isActive: boolean;
    allProjects: AccessLevel | null;
    access: Record<string, AccessLevel>;
    staffed: Record<string, 'lead' | 'engineer'>;
  }[];
}

export interface AccessChange {
  userId: string;
  projectId?: string;
  level: AccessLevel | null;
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
  startDate: string | null;
  plannedDate: string | null;
  completedDate: string | null;
  assignee: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  jiraKey: string | null;
  jiraUrl: string | null;
  jiraSyncError: string | null;
  subtasks: ApiJiraSubtask[];
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
  scope: 'INFRASTRUCTURE' | 'APPLICATION';
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
  startDate: string | null;
  dueDate: string | null;
  estimateSeconds: number | null;
  spentSeconds: number | null;
  remainingSeconds: number | null;
}

export interface ApiJiraTransition {
  id: string;
  name: string;
  to: string;
  category: JiraStatusCategory;
}

export interface ApiTimeLog {
  id: string;
  planId: string;
  technology: string;
  cycle: string;
  targetVersion: string | null;
  issueKey: string;
  summary: string;
  url: string | null;
  author: string;
  started: string;
  seconds: number;
  comment: string | null;
}

export interface ApiJiraWorklog {
  id: string;
  author: string;
  started: string;
  seconds: number;
  comment: string | null;
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
      jiraIntegrationId?: string | null;
      jiraProjectKey?: string | null;
      teamsIntegrationId?: string | null;
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

  allUsers() {
    return this.http.get<ApiUser[]>('/api/v1/users?all=true');
  }

  inviteUser(body: {
    email: string;
    displayName?: string;
    role: RoleName;
    allProjects?: AccessLevel | null;
    projects?: { projectId: string; level: AccessLevel }[];
  }) {
    return this.http.post<ApiUser>('/api/v1/users', body);
  }

  accessMatrix() {
    return this.http.get<ApiAccessMatrix>('/api/v1/access');
  }

  saveAccess(changes: AccessChange[]) {
    return this.http.put<ApiAccessMatrix>('/api/v1/access', { changes });
  }

  updateUser(id: string, body: { displayName?: string; role?: RoleName; isActive?: boolean }) {
    return this.http.patch<ApiUser>(`/api/v1/users/${id}`, body);
  }

  roles() {
    return this.http.get<ApiRole[]>('/api/v1/roles');
  }

  createRole(body: ApiRoleInput) {
    return this.http.post<ApiRole>('/api/v1/roles', body);
  }

  updateRole(key: string, body: Partial<ApiRoleInput>) {
    return this.http.patch<ApiRole>(`/api/v1/roles/${encodeURIComponent(key)}`, body);
  }

  deleteRole(key: string, moveTo?: string) {
    return this.http.delete<void>(`/api/v1/roles/${encodeURIComponent(key)}`, {
      params: moveTo ? { moveTo } : {},
    });
  }

  readonly teamsResource = httpResource<ApiTeam[]>(() => '/api/v1/teams');
  readonly teams = computed(() => this.teamsResource.value() ?? []);

  archivedTeams() {
    return this.http.get<ApiTeam[]>('/api/v1/teams/archived');
  }

  integrations() {
    return this.http.get<ApiIntegration[]>('/api/v1/integrations');
  }

  readonly integrationOptionsResource = httpResource<ApiIntegrationOption[]>(() => '/api/v1/integrations/options');
  readonly integrationOptions = computed(() => this.integrationOptionsResource.value() ?? []);

  createIntegration(body: IntegrationInput & { kind: IntegrationKind }) {
    return this.http.post<ApiIntegration>('/api/v1/integrations', body);
  }

  updateIntegration(id: string, body: IntegrationInput) {
    return this.http.patch<ApiIntegration>(`/api/v1/integrations/${id}`, body);
  }

  testIntegration(id: string) {
    return this.http.post<ApiIntegration>(`/api/v1/integrations/${id}/test`, {});
  }

  makeIntegrationDefault(id: string) {
    return this.http.post<ApiIntegration[]>(`/api/v1/integrations/${id}/default`, {});
  }

  deleteIntegration(id: string, moveTo?: string) {
    return this.http.delete<void>(`/api/v1/integrations/${id}`, { params: moveTo ? { moveTo } : {} });
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
      startDate?: string;
      dueDate?: string;
      assigneeId?: string;
      estimate?: string;
    },
  ) {
    return this.http.post<ApiJiraLink>(
      `/api/v1/upgrade-actions/${actionId}/jira/subtasks`,
      body,
    );
  }

  timeLog(from: string, to: string) {
    return this.http.get<ApiTimeLog[]>(`/api/v1/jira/time-log?from=${from}&to=${to}`);
  }

  createJiraIssue(actionId: string) {
    return this.http.post<ApiJiraLink>(`/api/v1/upgrade-actions/${actionId}/jira/create`, {});
  }

  updateJiraSubtask(
    actionId: string,
    key: string,
    body: {
      summary?: string;
      assigneeId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      estimate?: string;
    },
  ) {
    return this.http.patch<ApiJiraLink>(`/api/v1/upgrade-actions/${actionId}/jira/subtasks/${key}`, body);
  }

  subtaskTransitions(actionId: string, key: string) {
    return this.http.get<ApiJiraTransition[]>(
      `/api/v1/upgrade-actions/${actionId}/jira/subtasks/${key}/transitions`,
    );
  }

  transitionSubtask(actionId: string, key: string, transitionId: string) {
    return this.http.post<ApiJiraLink>(
      `/api/v1/upgrade-actions/${actionId}/jira/subtasks/${key}/transitions`,
      { transitionId },
    );
  }

  subtaskWorklogs(actionId: string, key: string) {
    return this.http.get<ApiJiraWorklog[]>(`/api/v1/upgrade-actions/${actionId}/jira/subtasks/${key}/worklogs`);
  }

  logSubtaskWork(actionId: string, key: string, body: { time: string; date: string; comment?: string }) {
    return this.http.post<ApiJiraLink>(`/api/v1/upgrade-actions/${actionId}/jira/subtasks/${key}/worklogs`, body);
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

  readonly editableEverywhere = computed(() => {
    const list = this.projects();
    return list.length > 0 && list.every((p) => p.access !== 'VIEW');
  });

  canEditProject(projectId: string | null | undefined): boolean {
    if (!projectId) return this.editableEverywhere();
    return this.projects().find((p) => p.id === projectId)?.access !== 'VIEW';
  }
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
