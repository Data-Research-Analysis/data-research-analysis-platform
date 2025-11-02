import type { IDataSource } from '~/types/IDataSource';
import { useDataSourceStore } from '@/stores/data_sources';

/**
 * Composable for fetching data sources list with client-side SSR
 * 
 * This composable returns data sources filtered by project ID from the store.
 * Data sources are already loaded in default.vue layout, so we just filter them here.
 * 
 * Uses `server: false` since data source pages are protected and don't need SEO.
 * 
 * @param projectId - The ID of the project to filter data sources for
 * @returns Object with data sources, pending state, error, and refresh function
 * 
 * @example
 * const { data: dataSources, pending, error } = useDataSources(projectId)
 */
export const useDataSources = (projectId: string | number) => {
  const dataSourcesStore = useDataSourceStore();
  
  // Get all data sources from store and filter by project ID
  const dataSources = computed(() => {
    const allDataSources = dataSourcesStore.getDataSources();
    const pid = parseInt(projectId.toString());
    
    console.log('useDataSources - All data sources:', allDataSources.length);
    console.log('useDataSources - First data source structure:', allDataSources[0]);
    console.log('useDataSources - Looking for project_id:', pid);
    
    const filtered = allDataSources.filter((ds: any) => {
      // Check both project_id field and project.id (in case backend returns project relation)
      const dsProjectId = ds.project_id || ds.project?.id;
      console.log('Checking data source:', ds.id, 'project_id:', ds.project_id, 'project.id:', ds.project?.id, 'matches:', dsProjectId === pid);
      return dsProjectId === pid;
    });
    
    console.log('useDataSources - Filtered for project', pid, ':', filtered.length);
    console.log('useDataSources - Filtered data:', filtered);
    
    return filtered;
  });

  // Check if store has data, if not set pending to true
  const pending = ref(dataSourcesStore.getDataSources().length === 0);
  const error = ref(null);
  
  // Watch for store data to be loaded
  watch(() => dataSourcesStore.getDataSources(), (newDataSources) => {
    if (newDataSources.length > 0) {
      pending.value = false;
    }
  });
  
  // Refresh function to reload data sources from API
  const refresh = async () => {
    pending.value = true;
    try {
      await dataSourcesStore.retrieveDataSources();
      error.value = null;
    } catch (e) {
      error.value = e as any;
    } finally {
      pending.value = false;
    }
  };

  return { 
    data: dataSources, 
    pending: readonly(pending), 
    error: readonly(error), 
    refresh 
  };
};

/**
 * Composable for fetching a single data source by ID with client-side SSR
 * 
 * @param dataSourceId - The ID of the data source to fetch
 * @returns Object with data source data, pending state, error, and refresh function
 * 
 * @example
 * const { data: dataSource, pending, error } = useDataSource(dataSourceId)
 */
export const useDataSource = (dataSourceId: string | number) => {
  const dataSourcesStore = useDataSourceStore();

  const { data: dataSource, pending, error, refresh } = useAuthenticatedFetch<IDataSource>(
    `data-source-${dataSourceId}`,
    `/data-source/${dataSourceId}`,
    {
      method: 'GET',
      transform: (data) => data || null,
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && dataSource.value) {
      dataSourcesStore.setSelectedDataSource(dataSource.value);
    }
  });

  return { data: dataSource, pending, error, refresh };
};
