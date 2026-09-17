interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Minimal in-memory cache with per-entry expiry.
 *
 * Used to keep repeated lookups off the endoflife.date API within a sync run
 * and between UI requests. Process-local on purpose: the data is public,
 * cheap to refetch, and not worth a Redis dependency.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
