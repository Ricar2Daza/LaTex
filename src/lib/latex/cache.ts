interface Entry<T> {
  value: T;
  bytes: number;
}

/** Caché LRU muy pequeña: evita recompilar el mismo documento mientras se navega. */
export class LruCache<T> {
  private map = new Map<string, Entry<T>>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries = 40,
    private readonly maxBytes = 256 * 1024 * 1024,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Reinsertar para marcarlo como el más reciente.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, bytes: number): void {
    const existing = this.map.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.map.delete(key);
    }
    this.map.set(key, { value, bytes });
    this.totalBytes += bytes;

    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      const removed = this.map.get(oldest.value);
      this.map.delete(oldest.value);
      if (removed) this.totalBytes -= removed.bytes;
    }
  }
}
