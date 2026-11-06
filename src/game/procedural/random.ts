export function hash(value: string): number {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function random(seed: number): () => number {
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class LRU<K, V> {
  private cache = new Map<K, V>();
  constructor(readonly capacity: number) {}
  get(key: K) {
    const v = this.cache.get(key);
    if (v !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, v);
    }
    return v;
  }
  set(key: K, value: V) {
    this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity)
      this.cache.delete(this.cache.keys().next().value!);
    return value;
  }
  get size() {
    return this.cache.size;
  }
  clear() {
    this.cache.clear();
  }
}
