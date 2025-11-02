import type { IDataModel } from '~/types/IDataModel';
import { useDataModelsStore } from '@/stores/data_models';

/**
 * Composable for fetching data models list with client-side SSR
 * 
 * This composable fetches the user's data models from the API and syncs them
 * with the Pinia store for backward compatibility.
 * 
 * Uses `server: false` since data model pages are protected and don't need SEO.
 * 
 * @param projectId - The ID of the project to fetch data models for
 * @returns Object with data models, pending state, error, and refresh function
 * 
 * @example
 * const { data: dataModels, pending, error } = useDataModels(projectId)
 */
export const useDataModels = (projectId: string | number) => {
  const dataModelsStore = useDataModelsStore();

  const { data: dataModels, pending, error, refresh } = useAuthenticatedFetch<IDataModel[]>(
    `data-models-${projectId}`,
    `/data-model/list/${projectId}`,
    {
      method: 'GET',
      transform: (data) => Array.isArray(data) ? data : [],
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && dataModels.value) {
      dataModelsStore.setDataModels(dataModels.value);
    }
  });

  return { data: dataModels, pending, error, refresh };
};

/**
 * Composable for fetching a single data model by ID with client-side SSR
 * 
 * @param dataModelId - The ID of the data model to fetch
 * @returns Object with data model data, pending state, error, and refresh function
 * 
 * @example
 * const { data: dataModel, pending, error } = useDataModel(dataModelId)
 */
export const useDataModel = (dataModelId: string | number) => {
  const dataModelsStore = useDataModelsStore();

  const { data: dataModel, pending, error, refresh } = useAuthenticatedFetch<IDataModel>(
    `data-model-${dataModelId}`,
    `/data-model/${dataModelId}`,
    {
      method: 'GET',
      transform: (data) => data || null,
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && dataModel.value) {
      dataModelsStore.setSelectedDataModel(dataModel.value);
    }
  });

  return { data: dataModel, pending, error, refresh };
};
