interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ReadOnlyMemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  public get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  /**
   * Coalesces concurrent misses for the same key into a single Firestore read
   * and caches successful results for ttlMs.
   */
  public async getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<{ value: T; cacheHit: boolean }> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return { value: cached, cacheHit: true };
    }

    const existingPromise = this.inFlight.get(key) as Promise<T> | undefined;
    if (existingPromise) {
      const value = await existingPromise;
      return { value, cacheHit: true };
    }

    const loadPromise = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, loadPromise);
    const value = await loadPromise;
    return { value, cacheHit: false };
  }
}

export const sharedOfficialCache = new ReadOnlyMemoryCache();
