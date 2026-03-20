/**
 * Cache Manager Composable
 * 
 * Provides intelligent caching with configurable TTLs per entity type,
 * cache invalidation, and related cache cascading.
 * 
 * Used by middleware to prevent redundant API calls and improve performance.
 */

export const useCacheManager = () => {
    // Cache durations in milliseconds per entity type
    const CACHE_DURATION: Record<string, number> = {
        projects: 5 * 60 * 1000,           // 5 minutes
        dataSources: 5 * 60 * 1000,        // 5 minutes
        dataModels: 5 * 60 * 1000,         // 5 minutes
        dashboards: 3 * 60 * 1000,         // 3 minutes
        organizations: 5 * 60 * 1000,      // 5 minutes
        workspaces: 5 * 60 * 1000,         // 5 minutes
        articles: 10 * 60 * 1000,          // 10 minutes
        categories: 10 * 60 * 1000,        // 10 minutes
        users: 5 * 60 * 1000,              // 5 minutes
        enterpriseQueries: 5 * 60 * 1000,  // 5 minutes
        widgetData: 1 * 60 * 1000,         // 1 minute (dashboards)
    };
    
    /**
     * Check if cached data is still fresh
     * @param cacheKey - Unique identifier for the cached data
     * @param entityType - Type of entity (determines TTL)
     * @returns true if cache is fresh, false otherwise
     */
    function isCacheFresh(cacheKey: string, entityType: string): boolean {
        if (typeof window === 'undefined') return false;
        
        // Check for force refresh flag
        const forceRefresh = localStorage.getItem('refreshData') === 'true';
        if (forceRefresh) {
            console.log(`[Cache] Force refresh active for ${cacheKey}`);
            return false;
        }
        
        const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);
        if (!timestamp) {
            console.log(`[Cache] No timestamp found for ${cacheKey}`);
            return false;
        }
        
        const age = Date.now() - parseInt(timestamp);
        const maxAge = CACHE_DURATION[entityType] || 60000; // Default 1 minute
        
        const isFresh = age < maxAge;
        console.log(`[Cache] ${cacheKey}: age=${Math.round(age/1000)}s, maxAge=${Math.round(maxAge/1000)}s, fresh=${isFresh}`);
        
        return isFresh;
    }
    
    /**
     * Mark data as cached with current timestamp
     * @param cacheKey - Unique identifier for the cached data
     */
    function markCached(cacheKey: string): void {
        if (typeof window === 'undefined') return;
        
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        console.log(`[Cache] Cached ${cacheKey} at ${new Date().toISOString()}`);
    }
    
    /**
     * Invalidate cache entries matching pattern(s)
     * @param pattern - Single pattern or array of patterns to match against cache keys
     */
    function invalidateCache(pattern: string | string[]): void {
        if (typeof window === 'undefined') return;
        
        const patterns = Array.isArray(pattern) ? pattern : [pattern];
        let invalidatedCount = 0;
        
        Object.keys(localStorage).forEach(key => {
            if (patterns.some(p => key.includes(p) && key.endsWith('_timestamp'))) {
                localStorage.removeItem(key);
                invalidatedCount++;
                console.log(`[Cache] Invalidated ${key}`);
            }
        });
        
        console.log(`[Cache] Invalidation complete: ${invalidatedCount} entries cleared`);
    }
    
    /**
     * Invalidate related caches when entity changes (cascade invalidation)
     * @param entity - Entity type that changed
     * @param id - Optional ID of the changed entity
     */
    function invalidateRelated(entity: string, id?: number): void {
        if (typeof window === 'undefined') return;
        
        // Define cascade relationships
        const cascadeMap: Record<string, string[]> = {
            // When data source changes, invalidate its specific cache and all data models
            dataSource: id ? [`dataSources_${id}`, 'dataModels'] : ['dataSources', 'dataModels'],
            
            // When data model changes, invalidate its specific cache and dashboards that might use it
            dataModel: id ? [`dataModels_${id}`, 'dashboards'] : ['dataModels', 'dashboards'],
            
            // When dashboard changes, invalidate its specific cache and all widget data
            dashboard: id ? [`dashboards_${id}`, `widgets_dashboard_${id}`] : ['dashboards', 'widgets'],
            
            // When project changes, invalidate everything project-related
            project: id ? [`projects_${id}`, 'dataSources', 'dataModels', 'dashboards'] : ['projects', 'dataSources', 'dataModels', 'dashboards'],
            
            // When organization changes, invalidate workspaces and projects
            organization: id ? [`organizations_${id}`, `workspaces_org_${id}`, 'projects'] : ['organizations', 'workspaces', 'projects'],
        };
        
        const toInvalidate = cascadeMap[entity] || [];
        
        if (toInvalidate.length > 0) {
            console.log(`[Cache] Cascading invalidation for ${entity}${id ? ` #${id}` : ''}: ${toInvalidate.join(', ')}`);
            invalidateCache(toInvalidate);
        }
    }
    
    /**
     * Clear all cache timestamps (nuclear option)
     */
    function clearAllCache(): void {
        if (typeof window === 'undefined') return;
        
        Object.keys(localStorage).forEach(key => {
            if (key.endsWith('_timestamp')) {
                localStorage.removeItem(key);
            }
        });
        
        console.log('[Cache] All cache timestamps cleared');
    }
    
    /**
     * Get cache statistics for debugging
     */
    function getCacheStats(): { key: string; age: number; fresh: boolean }[] {
        if (typeof window === 'undefined') return [];
        
        const stats: { key: string; age: number; fresh: boolean }[] = [];
        
        Object.keys(localStorage).forEach(key => {
            if (key.endsWith('_timestamp')) {
                const timestamp = localStorage.getItem(key);
                if (timestamp) {
                    const age = Date.now() - parseInt(timestamp);
                    const entityType = key.split('_')[0];
                    const maxAge = CACHE_DURATION[entityType] || 60000;
                    
                    stats.push({
                        key: key.replace('_timestamp', ''),
                        age: Math.round(age / 1000), // Convert to seconds
                        fresh: age < maxAge
                    });
                }
            }
        });
        
        return stats.sort((a, b) => a.age - b.age);
    }
    
    return {
        isCacheFresh,
        markCached,
        invalidateCache,
        invalidateRelated,
        clearAllCache,
        getCacheStats,
        CACHE_DURATION
    };
};
