import { useDashboardsStore } from '@/stores/dashboards';

export const usePublicDashboard = (dashboardKey: string) => {
  const dashboardsStore = useDashboardsStore();
  
  // Get runtime config BEFORE the async function to avoid context issues
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  
  const { data: dashboardData, pending, error, refresh } = useAsyncData(
    `public-dashboard-${dashboardKey}`,
    async () => {
      try {
        // Fetch token directly without using baseUrl() to avoid composable context issues
        const tokenUrl = `${apiUrl}/generate-token`;
        const tokenResponse = await fetch(tokenUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseToken = await tokenResponse.json();
        const token = responseToken.token;
        
        // Fetch public dashboard
        const url = `${apiUrl}/dashboard/public-dashboard-link/${encodeURIComponent(dashboardKey)}`;
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "non-auth",
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch public dashboard: ${response.statusText}`);
        }
        
        const data = await response.json();
        
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
