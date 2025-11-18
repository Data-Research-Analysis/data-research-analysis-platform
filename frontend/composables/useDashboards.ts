import type { IDashboard } from '~/types/IDashboard';
import { useDashboardsStore } from '@/stores/dashboards';

/**
 * Composable for fetching authenticated dashboards list with client-side SSR
 * 
 * This composable returns dashboards filtered by project ID from the store.
 * Dashboards are already loaded in default.vue layout, so we just filter them here.
 * 
 * Note: This is different from usePublicDashboard which is for public dashboards.
 * 
 * Uses `server: false` since dashboard pages are protected and don't need SEO.
 * 
 * @param projectId - The ID of the project to filter dashboards for
 * @returns Object with dashboards, pending state, error, and refresh function
 * 
 * @example
 * const { data: dashboards, pending, error } = useDashboards(projectId)
 */
export const useDashboards = (projectId: string | number) => {
  const dashboardsStore = useDashboardsStore();
  
  // Get all dashboards from store and filter by project ID
  const dashboards = computed(() => {
    const allDashboards = dashboardsStore.getDashboards();
    const pid = parseInt(projectId.toString());
    
    // Filter dashboards by project_id or project.id
    return allDashboards.filter((dashboard: any) => {
      const dashboardProjectId = dashboard.project_id || dashboard.project?.id;
      return dashboardProjectId === pid;
    });
  });

  // Pending is false immediately since data is already in store from default.vue
  const pending = ref(false);
  const error = ref(null);
  
  // Refresh function to reload dashboards from API
  const refresh = async () => {
    pending.value = true;
    try {
      await dashboardsStore.retrieveDashboards();
      error.value = null;
    } catch (e) {
      error.value = e as any;
    } finally {
      pending.value = false;
    }
  };

  return { 
    data: dashboards, 
    pending: readonly(pending), 
    error: readonly(error), 
    refresh 
  };
};

/**
 * Composable for fetching a single authenticated dashboard by ID with client-side SSR
 * 
 * @param dashboardId - The ID of the dashboard to fetch
 * @returns Object with dashboard data, pending state, error, and refresh function
 * 
 * @example
 * const { data: dashboard, pending, error } = useDashboard(dashboardId)
 */
export const useDashboard = (dashboardId: string | number) => {
  const dashboardsStore = useDashboardsStore();

  const { data: dashboard, pending, error, refresh } = useAuthenticatedFetch<IDashboard>(
    `dashboard-${dashboardId}`,
    `/dashboard/${dashboardId}`,
    {
      method: 'GET',
      transform: (data) => data || null,
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && dashboard.value) {
      dashboardsStore.setSelectedDashboard(dashboard.value);
    }
  });

  return { data: dashboard, pending, error, refresh };
};
