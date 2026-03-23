/**
 * Stale-While-Revalidate (SWR) Composable
 * 
 * Implements the SWR caching pattern:
 * 1. Return cached data immediately if available (fast user experience)
 * 2. Fetch fresh data in background (keeps data up-to-date)
 * 3. Update UI when fresh data arrives (seamless updates)
 * 4. Keep stale data on error (graceful degradation)
 * 
 * This pattern is ideal for:
 * - Improving perceived performance (instant data display)
 * - Balancing freshness with speed
 * - Handling intermittent network issues gracefully
 * 
 * Usage:
 * ```typescript
 * const { fetch: swrFetch } = useStaleWhileRevalidate<IProject[]>();
 * 
 * const projects = await swrFetch(
 *   'projects-list',
 *   () => projectsStore.fetchProjects(),
 *   {
 *     maxStaleTime: 5 * 60 * 1000, // 5 minutes
 *     onUpdate: (freshData) => {
 *       projectsStore.setProjects(freshData);
 *       console.log('Projects updated in background');
 *     }
 *   }
 * );
 * ```
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    isRevalidating: boolean;
}

interface SWROptions<T> {
    /**
     * Maximum time (ms) before data is considered too stale
     * Default: 5 minutes
     */
    maxStaleTime?: number;
    
    /**
     * Time (ms) when data is considered "fresh" (won't revalidate)
     * Default: half of maxStaleTime
     */
    freshTime?: number;
    
    /**
     * Callback when fresh data arrives from background revalidation
     */
    onUpdate?: (data: T) => void;
    
    /**
     * Callback when revalidation fails
     */
    onError?: (error: any) => void;
    
    /**
     * Whether to deduplicate concurrent requests
     * Default: true
     */
    dedupe?: boolean;
}

// Global cache map
const cache = new Map<string, CacheEntry<any>>();

// Track in-flight requests for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

export const useStaleWhileRevalidate = <T>() => {
    /**
     * Fetch with SWR strategy
     * @param key - Unique cache key
     * @param fetchFn - Function to fetch fresh data
     * @param options - SWR options
     * @returns Data (either cached or fresh)
     */
    async function fetch(
        key: string,
        fetchFn: () => Promise<T>,
        options: SWROptions<T> = {}
    ): Promise<T> {
        const {
            maxStaleTime = 5 * 60 * 1000,  // 5 minutes default
            freshTime = maxStaleTime / 2,   // Consider fresh for half the stale time
            onUpdate,
            onError,
            dedupe = true
        } = options;
        
        const cached = cache.get(key);
        const now = Date.now();
        
        if (cached) {
            const age = now - cached.timestamp;
            
            // Data is fresh - return immediately without revalidation
            if (age < freshTime) {
                console.log(`[SWR] Fresh cache hit for "${key}" (age: ${Math.round(age / 1000)}s)`);
                return cached.data;
            }
            
            // Data is stale but acceptable - return immediately and revalidate in background
            if (age < maxStaleTime && !cached.isRevalidating) {
                console.log(`[SWR] Stale cache hit for "${key}" (age: ${Math.round(age / 1000)}s), revalidating in background...`);
                
                // Mark as revalidating to prevent duplicate revalidations
                cached.isRevalidating = true;
                
                // Revalidate in background (non-blocking)
                setTimeout(async () => {
                    try {
                        const fresh = await fetchFn();
                        
                        // Update cache with fresh data
                        cache.set(key, {
                            data: fresh,
                            timestamp: Date.now(),
                            isRevalidating: false
                        });
                        
                        console.log(`[SWR] Background revalidation succeeded for "${key}"`);
                        
                        // Notify subscriber of fresh data
                        if (onUpdate) {
                            onUpdate(fresh);
                        }
                    } catch (error) {
                        console.warn(`[SWR] Background revalidation failed for "${key}"`, error);
                        
                        // Reset revalidating flag
                        cached.isRevalidating = false;
                        
                        // Keep stale data in cache (graceful degradation)
                        if (onError) {
                            onError(error);
                        }
                    }
                }, 0); // Execute in next tick
                
                // Return stale data immediately
                return cached.data;
            }
            
            // Data is too stale or already revalidating - fetch synchronously
            if (age >= maxStaleTime) {
                console.log(`[SWR] Cache too stale for "${key}" (age: ${Math.round(age / 1000)}s), fetching fresh...`);
            }
        } else {
            console.log(`[SWR] Cache miss for "${key}", fetching...`);
        }
        
        // Check for in-flight request (deduplication)
        if (dedupe && inFlightRequests.has(key)) {
            console.log(`[SWR] Deduplicating request for "${key}"`);
            return inFlightRequests.get(key)!;
        }
        
        // No cache or too stale - fetch now
        const fetchPromise = (async () => {
            try {
                const fresh = await fetchFn();
                
                // Store in cache
                cache.set(key, {
                    data: fresh,
                    timestamp: Date.now(),
                    isRevalidating: false
                });
                
                return fresh;
            } finally {
                // Remove from in-flight requests
                inFlightRequests.delete(key);
            }
        })();
        
        // Track in-flight request
        if (dedupe) {
            inFlightRequests.set(key, fetchPromise);
        }
        
        return fetchPromise;
    }
    
    /**
     * Mutate cached data without fetching
     * Useful for optimistic updates
     */
    function mutate(key: string, data: T, options: { revalidate?: boolean } = {}): void {
        cache.set(key, {
            data,
            timestamp: Date.now(),
            isRevalidating: false
        });
        
        console.log(`[SWR] Mutated cache for "${key}"`);
        
        // Optionally trigger revalidation after mutation
        if (options.revalidate) {
            const cached = cache.get(key);
            if (cached) {
                cached.isRevalidating = true;
            }
        }
    }
    
    /**
     * Invalidate cache entry (force refetch on next access)
     */
    function invalidate(key: string): void {
        cache.delete(key);
        console.log(`[SWR] Invalidated cache for "${key}"`);
    }
    
    /**
     * Invalidate multiple cache entries by pattern
     */
    function invalidatePattern(pattern: string | RegExp): void {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let count = 0;
        
        for (const key of cache.keys()) {
            if (regex.test(key)) {
                cache.delete(key);
                count++;
            }
        }
        
        console.log(`[SWR] Invalidated ${count} cache entries matching pattern: ${pattern}`);
    }
    
    /**
     * Clear all cache
     */
    function clearCache(): void {
        const size = cache.size;
        cache.clear();
        inFlightRequests.clear();
        console.log(`[SWR] Cleared all cache (${size} entries)`);
    }
    
    /**
     * Get cached data without fetching (returns undefined if not cached)
     */
    function getCached(key: string): T | undefined {
        return cache.get(key)?.data;
    }
    
    /**
     * Check if data is cached
     */
    function isCached(key: string): boolean {
        return cache.has(key);
    }
    
    /**
     * Get cache entry metadata
     */
    function getCacheMetadata(key: string): { age: number; isRevalidating: boolean } | null {
        const entry = cache.get(key);
        if (!entry) return null;
        
        return {
            age: Date.now() - entry.timestamp,
            isRevalidating: entry.isRevalidating
        };
    }
    
    /**
     * Get cache statistics
     */
    function getCacheStats() {
        const entries = Array.from(cache.entries());
        const now = Date.now();
        
        return {
            totalEntries: entries.length,
            keyCached: entries.map(([key]) => key),
            revalidatingCount: entries.filter(([_, entry]) => entry.isRevalidating).length,
            averageAge: entries.length > 0
                ? entries.reduce((sum, [_, entry]) => sum + (now - entry.timestamp), 0) / entries.length / 1000
                : 0,
            oldestEntry: entries.length > 0
                ? Math.max(...entries.map(([_, entry]) => now - entry.timestamp)) / 1000
                : 0
        };
    }
    
    return {
        fetch,
        mutate,
        invalidate,
        invalidatePattern,
        clearCache,
        getCached,
        isCached,
        getCacheMetadata,
        getCacheStats
    };
};
