export const EOL_DATA_SOURCE = Symbol('EOL_DATA_SOURCE');

export type EolField = 'eol' | 'eoas' | 'eoes';

export interface EolProductSummary {
  slug: string;
  label: string;
  category: string;
  aliases: string[];
  tags: string[];
}

export interface EolReleaseLatest {
  name: string;
  date: string | null;
  link: string | null;
}

export interface EolRelease {
  cycle: string;
  label: string;
  codename: string | null;
  releaseDate: string | null;
  isLts: boolean;
  ltsFrom: string | null;
  eoasFrom: string | null;
  eolFrom: string | null;
  eoesFrom: string | null;
  isMaintained: boolean;
  latest: EolReleaseLatest | null;
}

export interface EolProduct extends EolProductSummary {
  phaseLabels: Record<string, string | null>;
  releasePolicyUrl: string | null;
  htmlUrl: string | null;
  releases: EolRelease[];
}

export interface EolDataSource {
  listProducts(): Promise<EolProductSummary[]>;

  listProductsFull(): Promise<EolProduct[]>;

  getProduct(slug: string): Promise<EolProduct>;

  getRelease(slug: string, cycle: string): Promise<EolRelease | null>;

  getLatestRelease(slug: string): Promise<EolRelease | null>;

  listCategories(): Promise<string[]>;

  listProductsByCategory(category: string): Promise<EolProductSummary[]>;

  listTags(): Promise<string[]>;

  listProductsByTag(tag: string): Promise<EolProductSummary[]>;
}
