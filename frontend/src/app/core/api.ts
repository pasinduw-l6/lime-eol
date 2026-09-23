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
  readonly projectsResource = httpResource<ApiProject[]>(() => '/api/v1/projects');
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
    // The catalogue's "already registered" marks go stale on every add.
    this.catalogueResource.reload();
  }
}
