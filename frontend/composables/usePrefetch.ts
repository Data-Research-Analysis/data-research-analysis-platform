/**
 * Prefetch Composable
 * 
 * Intelligently prefetches data for likely next routes based on navigation patterns.
 * Uses intersection observer for link hovering and predictive loading.
 * 
 * Improves perceived performance by loading data before user navigates.
 */

import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';

export const usePrefetch = () => {
    const cacheManager = useCacheManager();
    
    /**
     * Predict likely next routes based on current route
     * Uses common navigation patterns to anticipate user behavior
     */
    function predictNextRoutes(currentRoute: string): string[] {
        const predictions: string[] = [];
        
        // From data sources page → likely to go to data models or dashboards
        if (currentRoute.match(/\/projects\/\d+\/data-sources$/)) {
            const projectId = currentRoute.match(/\/projects\/(\d+)\//)?.[1];
            if (projectId) {
                predictions.push(`/projects/${projectId}/data-models`);
                predictions.push(`/projects/${projectId}/dashboards`);
            }
        }
        
        // From data models page → likely to go to dashboards or edit a model
        if (currentRoute.match(/\/projects\/\d+\/data-models$/)) {
            const projectId = currentRoute.match(/\/projects\/(\d+)\//)?.[1];
            if (projectId) {
                predictions.push(`/projects/${projectId}/dashboards`);
                // Could also prefetch the first data model edit page
            }
        }
        
        // From data model edit page → likely to preview or go to dashboards
        if (currentRoute.match(/\/projects\/\d+\/data-sources\/\d+\/data-models\/\d+\/edit$/)) {
            const projectId = currentRoute.match(/\/projects\/(\d+)\//)?.[1];
            if (projectId) {
                predictions.push(`/projects/${projectId}/dashboards`);
            }
        }
        
        // From dashboards list → likely to open a dashboard
        if (currentRoute.match(/\/projects\/\d+\/dashboards$/)) {
            // Dashboard data already loaded, no predictions needed
        }
        
        // From project detail → likely to go to data sources
        if (currentRoute.match(/\/projects\/\d+$/)) {
            const projectId = currentRoute.match(/\/projects\/(\d+)$/)?.[1];
            if (projectId) {
                predictions.push(`/projects/${projectId}/data-sources`);
            }
        }
        
        // From projects list → likely to open a project
        if (currentRoute === '/projects') {
            // Could prefetch data sources for the first project
        }
        
        console.log(`[Prefetch] Predicted next routes from ${currentRoute}:`, predictions);
        return predictions;
    }
    
    /**
     * Prefetch data requirements for a specific route
     * Silently loads data in background without blocking
     */
    async function prefetchRouteData(route: string, silent = true): Promise<void> {
        const requirements = getRouteRequirements(route);
        if (!requirements || requirements.load.length === 0) {
            if (!silent) console.log(`[Prefetch] No requirements for ${route}`);
            return;
        }
        
        const projectsStore = useProjectsStore();
        const dataSourceStore = useDataSourceStore();
        const dataModelsStore = useDataModelsStore();
        const dashboardsStore = useDashboardsStore();
        
        try {
            const prefetchTasks: Promise<void>[] = [];
            
            for (const requirement of requirements.load) {
                const [entity, type] = requirement.split(':');
                const cacheKey = `${entity}_${type}`;
                
                // Skip if already cached
                if (cacheManager.isCacheFresh(cacheKey, entity)) {
                    if (!silent) console.log(`[Prefetch] Skipping ${cacheKey} - already cached`);
                    continue;
                }
                
                if (!silent) console.log(`[Prefetch] Loading ${cacheKey}...`);
                
                // Dispatch prefetch based on requirement
                switch (requirement) {
                    case 'projects:metadata':
                        prefetchTasks.push((async () => {
                            await projectsStore.retrieveProjects();
                            cacheManager.markCached(cacheKey);
                        })());
                        break;
                        
                    case 'dataSources:metadata':
                        prefetchTasks.push((async () => {
                            await dataSourceStore.retrieveDataSources();
                            cacheManager.markCached(cacheKey);
                        })());
                        break;
                        
                    case 'dataModels:metadata':
                        // Extract project ID from route
                        const projectId = route.match(/\/projects\/(\d+)\//)?.[1];
                        if (projectId) {
                            prefetchTasks.push((async () => {
                                await dataModelsStore.retrieveDataModels(parseInt(projectId));
                                cacheManager.markCached(`${cacheKey}_${projectId}`);
                            })());
                        }
                        break;
                        
                    case 'dashboards:metadata':
                        prefetchTasks.push((async () => {
                            await dashboardsStore.retrieveDashboards();
                            cacheManager.markCached(cacheKey);
                        })());
                        break;
                }
            }
            
            await Promise.all(prefetchTasks);
            
            if (!silent) {
                console.log(`[Prefetch] ✅ Prefetched ${prefetchTasks.length} resources for ${route}`);
            }
        } catch (error) {
            if (!silent) {
                console.warn(`[Prefetch] ⚠️ Failed to prefetch ${route}:`, error);
            }
            // Silently fail - prefetch errors shouldn't break the app
        }
    }
    
    /**
     * Setup link hover prefetching
     * Prefetches data when user hovers over links for 500ms
     */
    function setupLinkPrefetch(): void {
        if (typeof window === 'undefined') return;
        
        let hoverTimer: NodeJS.Timeout | null = null;
        let currentHoverLink: string | null = null;
        
        const handleMouseOver = (e: MouseEvent) => {
            // Find closest link element
            const link = (e.target as HTMLElement)?.closest('a[href^="/projects"]') as HTMLAnchorElement;
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href || href === currentHoverLink) return;
            
            // Clear previous timer
            if (hoverTimer) {
                clearTimeout(hoverTimer);
            }
            
            currentHoverLink = href;
            
            // Delay prefetch by 500ms to avoid prefetching on quick mouse movements
            hoverTimer = setTimeout(() => {
                console.log(`[Prefetch] Hovering over link: ${href}`);
                prefetchRouteData(href, true);
            }, 500);
        };
        
        const handleMouseOut = (e: MouseEvent) => {
            const link = (e.target as HTMLElement)?.closest('a[href^="/projects"]');
            if (!link) return;
            
            // Clear hover timer
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
            currentHoverLink = null;
        };
        
        // Attach event listeners
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);
        
        console.log('[Prefetch] Link hover prefetching enabled');
        
        // Return cleanup function
        return () => {
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mouseout', handleMouseOut);
            if (hoverTimer) clearTimeout(hoverTimer);
        };
    }
    
    /**
     * Prefetch predicted next routes based on current location
     */
    async function prefetchPredictedRoutes(currentRoute: string): Promise<void> {
        const predictions = predictNextRoutes(currentRoute);
        
        if (predictions.length === 0) return;
        
        console.log(`[Prefetch] Starting predictive prefetch for ${predictions.length} routes`);
        
        // Prefetch all predictions in parallel (silently)
        await Promise.all(predictions.map(route => prefetchRouteData(route, true)));
    }
    
    /**
     * Get route requirements (helper function)
     * Defines what data each route pattern needs
     */
    function getRouteRequirements(path: string): { load: string[] } | null {
        // This will be populated with the same route requirements from middleware
        // For now, return basic requirements based on route pattern
        
        if (path.match(/^\/projects$/)) {
            return { load: ['projects:metadata'] };
        }
        
        if (path.match(/^\/projects\/\d+\/data-sources/)) {
            return { load: ['projects:metadata', 'dataSources:metadata', 'dataModels:metadata'] };
        }
        
        if (path.match(/^\/projects\/\d+\/data-models/)) {
            return { load: ['projects:metadata', 'dataSources:metadata', 'dataModels:metadata'] };
        }
        
        if (path.match(/^\/projects\/\d+\/dashboards/)) {
            return { load: ['projects:metadata', 'dataSources:metadata', 'dataModels:metadata', 'dashboards:metadata'] };
        }
        
        return null;
    }
    
    return {
        predictNextRoutes,
        prefetchRouteData,
        setupLinkPrefetch,
        prefetchPredictedRoutes
    };
};
