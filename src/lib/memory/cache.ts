// Simple LRU cache for routing results

import type { RoutingResult } from "./types";

interface CacheEntry {
  result: RoutingResult;
  timestamp: number;
}

export class LRUCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 1000, ttlMinutes = 30) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): RoutingResult | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.result;
  }

  set(key: string, result: RoutingResult): void {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
