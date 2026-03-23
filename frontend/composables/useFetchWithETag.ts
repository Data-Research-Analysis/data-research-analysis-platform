/**
 * Composable for HTTP ETag-based conditional requests
 * 
 * This composable implements client-side ETag caching:
 * 1. Stores ETags from server responses
 * 2. Sends If-None-Match header on subsequent requests
 * 3. Handles 304 Not Modified responses by returning cached data
 * 4. Automatically updates ETags when fresh data is received
 * 
 * Benefits:
 * - Reduces bandwidth (no data transfer on 304 responses)
 * - Faster responses (304 is much quicker than full response)
 * - Transparent to calling code (just use fetchWithETag instead of $fetch)
 * 
 * Usage:
 * ```typescript
 * const { fetchWithETag, clearETagCache } = useFetchWithETag();
 * 
 * const data = await fetchWithETag<IProject[]>(
 *   `${baseUrl()}/projects`,
 *   { headers: { Authorization: `Bearer ${token}` } }
 * );
 * ```
 */

interface ETagCacheEntry {
    etag: string;
    data: any;
    timestamp: number;
}

// Global cache map (persists across component instances)
const etagCache = new Map<string, ETagCacheEntry>();

export const useFetchWithETag = () => {
    /**
     * Fetch data with ETag support
     * - Automatically sends If-None-Match header
     * - Returns cached data on 304 response
     * - Updates cache with new ETag on fresh data
     */
    async function fetchWithETag<T>(url: string, options: any = {}): Promise<T> {
        const cached = etagCache.get(url);
        
        // Prepare headers with ETag if we have one
        const headers = { ...options.headers };
        if (cached) {
            headers['If-None-Match'] = cached.etag;
        }
        
        try {
            let responseETag: string | null = null;
            
            const response = await $fetch<T>(url, {
                ...options,
                headers,
                onResponse({ response }) {
                    // Capture ETag from response headers
                    responseETag = response.headers.get('etag');
                },
                onResponseError({ response }) {
                    // Handle 304 Not Modified
                    if (response.status === 304 && cached) {
                        // This will be caught below and handled
                        responseETag = cached.etag;
                    }
                }
            });
            
            // Store new ETag if available
            if (responseETag && response) {
                etagCache.set(url, {
                    etag: responseETag,
                    data: response,
                    timestamp: Date.now()
                });
                
                console.log(`[ETag] Stored ETag for ${url}: ${responseETag}`);
            }
            
            return response;
            
        } catch (error: any) {
            // Handle 304 Not Modified - this is actually a success case
            if (error.response?.status === 304 && cached) {
                console.log(`[ETag] 304 Not Modified for ${url}, using cached data (age: ${(Date.now() - cached.timestamp) / 1000}s)`);
                
                // Update timestamp to track last validation
                cached.timestamp = Date.now();
                
                return cached.data as T;
            }
            
            // Re-throw other errors
            throw error;
        }
    }
    
    /**
     * Clear ETag cache for a specific URL or all URLs
     */
    function clearETagCache(url?: string): void {
        if (url) {
            etagCache.delete(url);
            console.log(`[ETag] Cleared cache for ${url}`);
        } else {
            etagCache.clear();
            console.log('[ETag] Cleared all ETag cache');
        }
    }
    
    /**
     * Get cached ETag for a URL (for debugging/inspection)
     */
    function getETag(url: string): string | null {
        return etagCache.get(url)?.etag || null;
    }
    
    /**
     * Check if we have cached data for a URL
     */
    function hasCachedData(url: string): boolean {
        return etagCache.has(url);
    }
    
    /**
     * Get cache statistics (for monitoring)
     */
    function getCacheStats() {
        const entries = Array.from(etagCache.entries());
        const now = Date.now();
        
        return {
            totalEntries: entries.length,
            urlsCached: entries.map(([url]) => url),
            averageAge: entries.length > 0
                ? entries.reduce((sum, [_, entry]) => sum + (now - entry.timestamp), 0) / entries.length / 1000
                : 0,
            oldestEntry: entries.length > 0
                ? Math.max(...entries.map(([_, entry]) => now - entry.timestamp)) / 1000
                : 0
        };
    }
    
    /**
     * Preload ETags from localStorage on client (optional persistence)
     */
    function loadETagsFromStorage() {
        if (!import.meta.client) return;
        
        try {
            const stored = localStorage.getItem('etag_cache');
            if (stored) {
                const entries = JSON.parse(stored);
                for (const [url, entry] of Object.entries(entries)) {
                    etagCache.set(url, entry as ETagCacheEntry);
                }
                console.log(`[ETag] Loaded ${Object.keys(entries).length} ETags from localStorage`);
            }
        } catch (error) {
            console.warn('[ETag] Failed to load ETags from storage:', error);
        }
    }
    
    /**
     * Save ETags to localStorage (optional persistence)
     */
    function saveETagsToStorage() {
        if (!import.meta.client) return;
        
        try {
            const entries = Object.fromEntries(etagCache.entries());
            localStorage.setItem('etag_cache', JSON.stringify(entries));
            console.log(`[ETag] Saved ${etagCache.size} ETags to localStorage`);
        } catch (error) {
            console.warn('[ETag] Failed to save ETags to storage:', error);
        }
    }
    
    return {
        fetchWithETag,
        clearETagCache,
        getETag,
        hasCachedData,
        getCacheStats,
        loadETagsFromStorage,
        saveETagsToStorage
    };
};
