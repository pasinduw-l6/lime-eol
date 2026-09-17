import { Inject, Injectable, Logger } from '@nestjs/common';
import { ZodError, ZodTypeAny, z } from 'zod';
import { TtlCache } from '../../../common/utils/ttl-cache';
import { EolConfig, eolConfig } from '../../../config/namespaces/eol.config';
import {
  EolDataSource,
  EolProduct,
  EolProductSummary,
  EolRelease,
} from '../ports/eol-data-source.port';
import {
  RawProduct,
  RawProductSummary,
  RawRelease,
  productListResponseSchema,
  productResponseSchema,
  releaseResponseSchema,
} from './endoflife-date.schema';

/** Responses change at most daily upstream, so an hour of caching is safe. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Upstream failures worth retrying — transient, not "you asked for nothing". */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class EolDataSourceError extends Error {
  constructor(
    message: string,
    readonly slug?: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EolDataSourceError';
  }
}

export class EolProductNotFoundError extends EolDataSourceError {
  constructor(slug: string) {
    super(`Unknown endoflife.date product "${slug}"`, slug, 404);
    this.name = 'EolProductNotFoundError';
  }
}

/**
 * endoflife.date API v1 adapter.
 *
 * Owns transport concerns only — URLs, timeouts, retries, caching and response
 * validation — and hands back domain types. No business rules live here.
 */
@Injectable()
export class EndOfLifeDateClient implements EolDataSource {
  private readonly logger = new Logger(EndOfLifeDateClient.name);
  private readonly cache = new TtlCache<unknown>(CACHE_TTL_MS);

  constructor(
    @Inject(eolConfig.KEY) private readonly config: EolConfig,
  ) {}

  async listProducts(): Promise<EolProductSummary[]> {
    const body = await this.request('products/', productListResponseSchema);
    return body.result.map((product) => this.toSummary(product));
  }

  async getProduct(slug: string): Promise<EolProduct> {
    const body = await this.request(
      `products/${encodeURIComponent(slug)}/`,
      productResponseSchema,
      slug,
    );

    return this.toProduct(body.result);
  }

  async getRelease(slug: string, cycle: string): Promise<EolRelease | null> {
    try {
      const body = await this.request(
        `products/${encodeURIComponent(slug)}/releases/${encodeURIComponent(cycle)}/`,
        releaseResponseSchema,
        slug,
      );

      return this.toRelease(body.result);
    } catch (error) {
      if (error instanceof EolProductNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /** Drops cached responses so the next call hits the network. */
  clearCache(): void {
    this.cache.clear();
  }

  private async request<T extends ZodTypeAny>(
    path: string,
    schema: T,
    slug?: string,
  ): Promise<z.infer<T>> {
    const cacheKey = path;
    const cached = this.cache.get(cacheKey);

    if (cached !== undefined) {
      return cached as z.infer<T>;
    }

    const payload = await this.fetchWithRetry(path, slug);

    try {
      const parsed = schema.parse(payload) as z.infer<T>;
      this.cache.set(cacheKey, parsed);
      return parsed;
    } catch (error) {
      const detail =
        error instanceof ZodError
          ? error.issues
              .slice(0, 5)
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ')
          : String(error);

      throw new EolDataSourceError(
        `Unexpected response shape from ${path} — ${detail}`,
        slug,
        undefined,
        error,
      );
    }
  }

  private async fetchWithRetry(path: string, slug?: string): Promise<unknown> {
    const url = `${this.config.apiBase.replace(/\/$/, '')}/${path}`;
    const { retryAttempts, retryBaseDelayMs } = this.config.http;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      if (attempt > 0) {
        const backoff = retryBaseDelayMs * 2 ** (attempt - 1);
        this.logger.warn(
          `Retry ${attempt}/${retryAttempts} for ${path} in ${backoff}ms`,
        );
        await delay(backoff);
      }

      try {
        return await this.fetchOnce(url, slug);
      } catch (error) {
        lastError = error;

        if (error instanceof EolProductNotFoundError) {
          throw error;
        }

        const status =
          error instanceof EolDataSourceError ? error.status : undefined;

        // A non-retryable status (e.g. 400) will fail identically next time.
        if (status !== undefined && !RETRYABLE_STATUS.has(status)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new EolDataSourceError(`Request to ${path} failed`, slug);
  }

  private async fetchOnce(url: string, slug?: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.http.timeoutMs,
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': this.config.http.userAgent,
        },
      });

      if (response.status === 404 && slug) {
        throw new EolProductNotFoundError(slug);
      }

      if (!response.ok) {
        throw new EolDataSourceError(
          `${url} returned HTTP ${response.status}`,
          slug,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof EolDataSourceError) {
        throw error;
      }

      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? `timed out after ${this.config.http.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : 'unknown error';

      throw new EolDataSourceError(`${url} ${reason}`, slug, undefined, error);
    } finally {
      clearTimeout(timer);
    }
  }

  private toSummary(raw: RawProductSummary): EolProductSummary {
    return {
      slug: raw.name,
      label: raw.label || raw.name,
      category: raw.category,
      aliases: raw.aliases,
      tags: raw.tags,
    };
  }

  private toProduct(raw: RawProduct): EolProduct {
    return {
      ...this.toSummary(raw),
      phaseLabels: raw.labels,
      htmlUrl: raw.links.html ?? null,
      releasePolicyUrl: raw.links.releasePolicy ?? null,
      releases: raw.releases.map((release) => this.toRelease(release)),
    };
  }

  private toRelease(raw: RawRelease): EolRelease {
    return {
      cycle: raw.name,
      label: raw.label || raw.name,
      codename: raw.codename,
      releaseDate: raw.releaseDate,
      isLts: raw.isLts,
      ltsFrom: raw.ltsFrom,
      eoasFrom: raw.eoasFrom,
      eolFrom: raw.eolFrom,
      eoesFrom: raw.eoesFrom,
      isMaintained: raw.isMaintained,
      latest: raw.latest,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
