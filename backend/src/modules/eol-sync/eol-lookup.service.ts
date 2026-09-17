import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EolDataSource,
  EolField,
  EolProductSummary,
  EOL_DATA_SOURCE,
} from './ports/eol-data-source.port';
import { EolProductNotFoundError } from './adapters/endoflife-date.client';
import { EolProductDto, EolProductSummaryDto, EolReleaseDto } from './dto/eol-product.dto';
import { mapReleaseToVersionLifecycle } from './mappers/release-to-version.mapper';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Read-only lifecycle lookups against the external source.
 *
 * Deliberately has no database dependency: this is what the registry uses to
 * discover slugs and cycles when a technology is being added. Writing the data
 * into technology_version is EolSyncService's job (Phase 7).
 */
@Injectable()
export class EolLookupService {
  private readonly logger = new Logger(EolLookupService.name);

  constructor(
    @Inject(EOL_DATA_SOURCE) private readonly dataSource: EolDataSource,
  ) {}

  async listProducts(filters: {
    q?: string;
    category?: string;
  }): Promise<EolProductSummaryDto[]> {
    const products = await this.dataSource.listProducts();
    const needle = filters.q?.trim().toLowerCase();

    return products
      .filter((product) =>
        filters.category ? product.category === filters.category : true,
      )
      .filter((product) => (needle ? matches(product, needle) : true))
      .map((product) => ({ ...product }));
  }

  async getProduct(slug: string, eolField: EolField = 'eol'): Promise<EolProductDto> {
    try {
      const product = await this.dataSource.getProduct(slug);

      return {
        slug: product.slug,
        label: product.label,
        category: product.category,
        aliases: product.aliases,
        tags: product.tags,
        htmlUrl: product.htmlUrl,
        releasePolicyUrl: product.releasePolicyUrl,
        phaseLabels: product.phaseLabels,
        releases: product.releases.map((release) => {
          const mapped = mapReleaseToVersionLifecycle(release, eolField);

          return {
            cycle: mapped.cycle,
            label: release.label,
            releaseDate: toIsoDate(mapped.releaseDate),
            isLts: mapped.isLts,
            activeSupportEnd: toIsoDate(mapped.activeSupportEnd),
            eolDate: toIsoDate(mapped.eolDate),
            latestSupported: mapped.latestSupported,
            isMaintained: release.isMaintained,
            daysToEol: daysUntil(mapped.eolDate),
          } satisfies EolReleaseDto;
        }),
      };
    } catch (error) {
      if (error instanceof EolProductNotFoundError) {
        throw new NotFoundException(
          `No endoflife.date product with slug "${slug}"`,
        );
      }

      this.logger.error(
        `Lookup failed for "${slug}": ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }
}

function matches(product: EolProductSummary, needle: string): boolean {
  return (
    product.slug.toLowerCase().includes(needle) ||
    product.label.toLowerCase().includes(needle) ||
    product.aliases.some((alias) => alias.toLowerCase().includes(needle))
  );
}

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function daysUntil(value: Date | null): number | null {
  if (!value) {
    return null;
  }

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return Math.round((value.getTime() - todayUtc) / MS_PER_DAY);
}
