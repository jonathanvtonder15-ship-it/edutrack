'use client'
// Lightweight in-memory cache for reference data that rarely changes.
// Reduces duplicate Supabase queries when navigating between pages.

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL = 60_000 // 60 seconds

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function cacheInvalidate(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

export function cacheClear(): void {
  cache.clear()
}

