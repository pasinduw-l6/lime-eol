import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';

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
  notes: string | null;
  cycles: ApiCycle[];
}

@Injectable({ providedIn: 'root' })
export class Api {
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
  }
}
