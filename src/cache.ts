// Tiny in-memory LRU cache with optional TTL support.
// For production, swap to a bounded cache with eviction telemetry.

interface CacheEntry<V> {
  value: V;
  expiresAt: number | null; // null = no expiration
}

export class LruCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();

  constructor(
    private capacity = 100,
    private ttlMs: number | null = null,
  ) {}

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (entry === undefined) {
      return undefined;
    }

    // Check TTL expiration
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    const entry: CacheEntry<V> = {
      value,
      expiresAt: this.ttlMs !== null ? Date.now() + this.ttlMs : null,
    };

    this.map.set(key, entry);

    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Get current number of entries in cache.
   */
  get size(): number {
    return this.map.size;
  }
}
