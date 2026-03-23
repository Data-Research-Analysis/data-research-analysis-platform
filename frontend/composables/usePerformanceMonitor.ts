/**
 * Performance Monitor Composable
 * 
 * Tracks middleware performance metrics including cache hit rates,
 * API call counts, navigation times, and overall system health.
 * 
 * Used for debugging and optimizing data loading strategies.
 */

import { reactive, computed } from 'vue';

// Singleton state shared across all usages
const globalMetrics = reactive({
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    navigationTime: 0,
    currentRoute: '',
    navigationStartTime: 0,
    lastNavigationDuration: 0,
    routeMetrics: {} as Record<string, {
        count: number;
        totalTime: number;
        avgTime: number;
        cacheHits: number;
        cacheMisses: number;
    }>
});

export const usePerformanceMonitor = () => {
    /**
     * Track a cache hit
     */
    function trackCacheHit(key: string): void {
        globalMetrics.cacheHits++;
        
        // Update route-specific metrics
        if (globalMetrics.currentRoute) {
            if (!globalMetrics.routeMetrics[globalMetrics.currentRoute]) {
                globalMetrics.routeMetrics[globalMetrics.currentRoute] = {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0,
                    cacheHits: 0,
                    cacheMisses: 0
                };
            }
            globalMetrics.routeMetrics[globalMetrics.currentRoute].cacheHits++;
        }
        
        const total = globalMetrics.cacheHits + globalMetrics.cacheMisses;
        const hitRate = total > 0 ? ((globalMetrics.cacheHits / total) * 100).toFixed(1) : '0.0';
        
        console.log(`[Perf] ✅ Cache HIT: ${key} (Hit rate: ${hitRate}% - ${globalMetrics.cacheHits}/${total})`);
    }
    
    /**
     * Track a cache miss
     */
    function trackCacheMiss(key: string): void {
        globalMetrics.cacheMisses++;
        
        // Update route-specific metrics
        if (globalMetrics.currentRoute) {
            if (!globalMetrics.routeMetrics[globalMetrics.currentRoute]) {
                globalMetrics.routeMetrics[globalMetrics.currentRoute] = {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0,
                    cacheHits: 0,
                    cacheMisses: 0
                };
            }
            globalMetrics.routeMetrics[globalMetrics.currentRoute].cacheMisses++;
        }
        
        const total = globalMetrics.cacheHits + globalMetrics.cacheMisses;
        const hitRate = total > 0 ? ((globalMetrics.cacheHits / total) * 100).toFixed(1) : '0.0';
        
        console.log(`[Perf] ❌ Cache MISS: ${key} (Hit rate: ${hitRate}% - ${globalMetrics.cacheHits}/${total})`);
    }
    
    /**
     * Track an API call
     */
    function trackApiCall(endpoint: string): void {
        globalMetrics.apiCalls++;
        console.log(`[Perf] 🌐 API call: ${endpoint} (Total: ${globalMetrics.apiCalls} this session)`);
    }
    
    /**
     * Start tracking navigation time
     */
    function startNavigationTracking(route: string): void {
        globalMetrics.currentRoute = route;
        globalMetrics.navigationStartTime = performance.now();
        console.log(`[Perf] 🚀 Navigation started to: ${route}`);
    }
    
    /**
     * End tracking navigation time and record duration
     */
    function endNavigationTracking(): void {
        if (!globalMetrics.navigationStartTime) return;
        
        const duration = performance.now() - globalMetrics.navigationStartTime;
        globalMetrics.lastNavigationDuration = duration;
        
        // Update route-specific metrics
        if (globalMetrics.currentRoute) {
            if (!globalMetrics.routeMetrics[globalMetrics.currentRoute]) {
                globalMetrics.routeMetrics[globalMetrics.currentRoute] = {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0,
                    cacheHits: 0,
                    cacheMisses: 0
                };
            }
            
            const routeMetric = globalMetrics.routeMetrics[globalMetrics.currentRoute];
            routeMetric.count++;
            routeMetric.totalTime += duration;
            routeMetric.avgTime = routeMetric.totalTime / routeMetric.count;
        }
        
        // Log with color coding based on performance
        if (duration < 500) {
            console.log(`[Perf] ⚡ FAST navigation: ${globalMetrics.currentRoute} in ${duration.toFixed(0)}ms`);
        } else if (duration < 2000) {
            console.log(`[Perf] ✅ Good navigation: ${globalMetrics.currentRoute} in ${duration.toFixed(0)}ms`);
        } else if (duration < 4000) {
            console.warn(`[Perf] ⚠️ Slow navigation: ${globalMetrics.currentRoute} in ${duration.toFixed(0)}ms`);
        } else {
            console.error(`[Perf] 🐌 VERY SLOW navigation: ${globalMetrics.currentRoute} in ${duration.toFixed(0)}ms (Target: < 1000ms)`);
        }
        
        globalMetrics.navigationStartTime = 0;
    }
    
    /**
     * Get current cache hit rate as percentage
     */
    function getCacheHitRate(): number {
        const total = globalMetrics.cacheHits + globalMetrics.cacheMisses;
        return total > 0 ? (globalMetrics.cacheHits / total) * 100 : 0;
    }
    
    /**
     * Get performance summary for debugging
     */
    function getPerformanceSummary(): {
        cacheHitRate: number;
        totalCacheChecks: number;
        totalApiCalls: number;
        lastNavigationTime: number;
        avgNavigationTime: number;
    } {
        const total = globalMetrics.cacheHits + globalMetrics.cacheMisses;
        const allNavigations = Object.values(globalMetrics.routeMetrics);
        const totalNavigations = allNavigations.reduce((sum, m) => sum + m.count, 0);
        const totalNavigationTime = allNavigations.reduce((sum, m) => sum + m.totalTime, 0);
        
        return {
            cacheHitRate: getCacheHitRate(),
            totalCacheChecks: total,
            totalApiCalls: globalMetrics.apiCalls,
            lastNavigationTime: globalMetrics.lastNavigationDuration,
            avgNavigationTime: totalNavigations > 0 ? totalNavigationTime / totalNavigations : 0
        };
    }
    
    /**
     * Get route-specific performance metrics
     */
    function getRouteMetrics(route: string) {
        return globalMetrics.routeMetrics[route] || null;
    }
    
    /**
     * Reset all metrics (useful for testing)
     */
    function resetMetrics(): void {
        globalMetrics.cacheHits = 0;
        globalMetrics.cacheMisses = 0;
        globalMetrics.apiCalls = 0;
        globalMetrics.navigationTime = 0;
        globalMetrics.currentRoute = '';
        globalMetrics.navigationStartTime = 0;
        globalMetrics.lastNavigationDuration = 0;
        globalMetrics.routeMetrics = {};
        
        console.log('[Perf] Metrics reset');
    }
    
    /**
     * Log full performance report
     */
    function logPerformanceReport(): void {
        const summary = getPerformanceSummary();
        
        console.group('[Perf] 📊 Performance Report');
        console.log(`Cache Hit Rate: ${summary.cacheHitRate.toFixed(1)}% (${globalMetrics.cacheHits} hits / ${summary.totalCacheChecks} checks)`);
        console.log(`Total API Calls: ${summary.totalApiCalls}`);
        console.log(`Last Navigation: ${summary.lastNavigationTime.toFixed(0)}ms`);
        console.log(`Avg Navigation: ${summary.avgNavigationTime.toFixed(0)}ms`);
        
        if (Object.keys(globalMetrics.routeMetrics).length > 0) {
            console.group('Route Breakdown:');
            Object.entries(globalMetrics.routeMetrics).forEach(([route, metrics]) => {
                console.log(`${route}:`, {
                    visits: metrics.count,
                    avgTime: `${metrics.avgTime.toFixed(0)}ms`,
                    cacheHitRate: metrics.cacheHits + metrics.cacheMisses > 0 
                        ? `${((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)}%`
                        : 'N/A'
                });
            });
            console.groupEnd();
        }
        
        console.groupEnd();
    }
    
    // Expose reactive metrics for UI binding if needed
    const metrics = computed(() => ({
        cacheHits: globalMetrics.cacheHits,
        cacheMisses: globalMetrics.cacheMisses,
        apiCalls: globalMetrics.apiCalls,
        hitRate: getCacheHitRate(),
        lastNavigationTime: globalMetrics.lastNavigationDuration
    }));
    
    return {
        metrics,
        trackCacheHit,
        trackCacheMiss,
        trackApiCall,
        startNavigationTracking,
        endNavigationTracking,
        getCacheHitRate,
        getPerformanceSummary,
        getRouteMetrics,
        resetMetrics,
        logPerformanceReport
    };
};
