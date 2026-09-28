import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EolDataSource,
  EolField,
  EolProductSummary,
  EolRelease,
  EOL_DATA_SOURCE,
} from './ports/eol-data-source.port';
import { EolProductNotFoundError } from './adapters/endoflife-date.client';
import { EolProductDto, EolProductSummaryDto, EolReleaseDto } from './dto/eol-product.dto';
import { mapReleaseToVersionLifecycle } from './mappers/release-to-version.mapper';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class EolLookupService {
  private readonly logger = new Logger(EolLookupService.name);

  constructor(
    @Inject(EOL_DATA_SOURCE) private readonly dataSource: EolDataSource,
  ) {}

  async listProducts(filters: {
    q?: string;
    category?: string;
    tag?: string;
  }): Promise<EolProductSummaryDto[]> {
    const products = filters.category
      ? await this.dataSource.listProductsByCategory(filters.category)
      : filters.tag
        ? await this.dataSource.listProductsByTag(filters.tag)
        : await this.dataSource.listProducts();

    const needle = filters.q?.trim().toLowerCase();

    return products
      .filter((product) => (needle ? matches(product, needle) : true))
      .map((product) => ({ ...product }));
  }

  listCategories(): Promise<string[]> {
    return this.dataSource.listCategories();
  }

  listTags(): Promise<string[]> {
    return this.dataSource.listTags();
  }

  async getRelease(
    slug: string,
    cycle: string,
    eolField: EolField = 'eol',
  ): Promise<EolReleaseDto> {
    const release =
      cycle === 'latest'
        ? await this.dataSource.getLatestRelease(slug)
        : await this.dataSource.getRelease(slug, cycle);

    if (!release) {
      throw new NotFoundException(
        `Product "${slug}" has no release cycle "${cycle}"`,
      );
    }

    return this.toReleaseDto(release, eolField);
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
        releases: product.releases.map((release) =>
          this.toReleaseDto(release, eolField),
        ),
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

  private toReleaseDto(
    release: EolRelease,
    eolField: EolField,
  ): EolReleaseDto {
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
    };
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
