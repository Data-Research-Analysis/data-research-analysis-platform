import { useDashboardsStore } from '@/stores/dashboards';
import type { IDashboard } from '@/types/IDashboard';
import type { IProject } from '@/types/IProject';

interface IPublicDashboardData {
  dashboard: IDashboard;
  project: IProject;
  key?: string;
}

export const usePublicDashboard = (dashboardKey: string) => {
  const dashboardsStore = useDashboardsStore();
  
  // Get runtime config BEFORE the async function to avoid context issues
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiBase; // Use standard apiBase instead of NUXT_API_URL
  
  const { data: dashboardData, pending, error, refresh } = useAsyncData<IPublicDashboardData | null>(
    `public-dashboard-${dashboardKey}`,
    async () => {
      try {
        // Fetch token directly without using baseUrl() to avoid composable context issues
        const tokenUrl = `${apiUrl}/generate-token`;
        const responseToken = await $fetch<any>(tokenUrl);
        const token = responseToken.token;
        
        // Fetch public dashboard
        const url = `${apiUrl}/dashboard/public-dashboard-link/${encodeURIComponent(dashboardKey)}`;
        
        const data = await $fetch<IPublicDashboardData>(url, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "non-auth",
          },
        });
        
        // Sync with store for client-side navigation
        if (import.meta.client && data) {
          dashboardsStore.setSelectedDashboard(data.dashboard);
        }
        
        return data;
      } catch (err) {
        console.error('[usePublicDashboard] Error fetching public dashboard:', err);
        // Return null instead of throwing to prevent page crash
        return null;
      }
    },
    {
      lazy: false,
      server: true,
      transform: (data) => data || null
    }
  );
  
  return { dashboardData, pending, error, refresh };
};
