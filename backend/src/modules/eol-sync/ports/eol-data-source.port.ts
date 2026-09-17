/**
 * The lifecycle data source the registry depends on.
 *
 * Consumers depend on this interface, never on endoflife.date directly, so the
 * provider can be swapped (or faked in tests) without touching sync logic.
 */
export const EOL_DATA_SOURCE = Symbol('EOL_DATA_SOURCE');

/** Which date field a technology treats as its end of life. */
export type EolField = 'eol' | 'eoas' | 'eoes';

export interface EolProductSummary {
  /** Slug used to address the product, e.g. "nodejs". */
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

/** One support cycle of a product, e.g. Node.js "24". */
export interface EolRelease {
  /** Cycle identifier — matches TechnologyVersion.cycle. */
  cycle: string;
  label: string;
  codename: string | null;
  releaseDate: string | null;
  isLts: boolean;
  ltsFrom: string | null;
  /** End of active support. */
  eoasFrom: string | null;
  /** End of life / security support. */
  eolFrom: string | null;
  /** End of extended/commercial support. */
  eoesFrom: string | null;
  isMaintained: boolean;
  latest: EolReleaseLatest | null;
}

export interface EolProduct extends EolProductSummary {
  /** What this product calls each support phase, for display. */
  phaseLabels: Record<string, string | null>;
  releasePolicyUrl: string | null;
  htmlUrl: string | null;
  releases: EolRelease[];
}

export interface EolDataSource {
  /** Every product the source knows about. */
  listProducts(): Promise<EolProductSummary[]>;

  /** One product with all of its release cycles. */
  getProduct(slug: string): Promise<EolProduct>;

  /** A single cycle, or null when the product has no such cycle. */
  getRelease(slug: string, cycle: string): Promise<EolRelease | null>;
}
